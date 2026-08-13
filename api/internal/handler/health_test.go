package handler

import (
	"context"
	"errors"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/labstack/echo/v4"
)

func TestReadinessSpecFindsTheReadyzOperation(t *testing.T) {
	actions := map[string]Spec{
		"GetAllNs":   {Method: "get", ResourcePath: "/ns"},
		"GetReadyz":  {Method: "get", ResourcePath: "/readyz"},
		"PostSomeNs": {Method: "post", ResourcePath: "/ns"},
	}

	spec, ok := readinessSpec(actions)
	if !ok {
		t.Fatal("the readiness operation was not found")
	}
	if spec.ResourcePath != "/readyz" {
		t.Fatalf("got %q, want /readyz", spec.ResourcePath)
	}
}

// Services name the operation differently; the path is what they agree on.
func TestReadinessSpecIgnoresTheOperationName(t *testing.T) {
	for _, name := range []string{"Health-Check-Readyz", "RestGetReadyz", "AntServerReadiness"} {
		actions := map[string]Spec{name: {Method: "get", ResourcePath: "/readyz"}}
		if _, ok := readinessSpec(actions); !ok {
			t.Fatalf("%s was not recognised", name)
		}
	}
}

// A POST that happens to end in /readyz is not a readiness check.
func TestReadinessSpecSkipsNonGet(t *testing.T) {
	actions := map[string]Spec{"PostReadyz": {Method: "post", ResourcePath: "/readyz"}}
	if _, ok := readinessSpec(actions); ok {
		t.Fatal("a POST was taken as the readiness operation")
	}
}

func TestReadinessSpecReportsAbsence(t *testing.T) {
	actions := map[string]Spec{"GetAllNs": {Method: "get", ResourcePath: "/ns"}}
	if _, ok := readinessSpec(actions); ok {
		t.Fatal("a service without a readiness endpoint was reported as having one")
	}
}

// The address has to be openable: a `{release}` left in it 404s on click, which
// reads as a missing specification rather than an unfinished address.
func TestSwaggerSourceFillsInTheRelease(t *testing.T) {
	s := Service{
		Version: "0.6.0(0.6.0)",
		Swagger: map[string]string{
			"latest":  "https://host/main/swagger.json",
			"release": "https://host/{release}/swagger.json",
		},
	}
	if got := swaggerSource(s); got != "https://host/v0.6.0/swagger.json" {
		t.Fatalf("got %q", got)
	}
}

func TestSwaggerSourceTakesLatestWhenTheLabelSaysSo(t *testing.T) {
	s := Service{
		Version: "0.12.42(latest)",
		Swagger: map[string]string{
			"latest":  "https://host/main/swagger.json",
			"release": "https://host/{release}/swagger.json",
		},
	}
	if got := swaggerSource(s); got != "https://host/main/swagger.json" {
		t.Fatalf("got %q", got)
	}
}

func TestSwaggerSourceHandlesAMissingLabel(t *testing.T) {
	s := Service{Swagger: map[string]string{"latest": "L"}}
	if got := swaggerSource(s); got != "L" {
		t.Fatalf("got %q, want L", got)
	}
	if got := swaggerSource(Service{}); got != "" {
		t.Fatalf("got %q, want empty", got)
	}
}

func TestSpecRefFromVersion(t *testing.T) {
	cases := map[string]string{
		"0.12.42(latest)": "latest",
		"0.6.0(0.6.0)":    "0.6.0",
		"0.5.5":           "",
		"":                "",
	}
	for in, want := range cases {
		if got := specRefFromVersion(in); got != want {
			t.Fatalf("%q gave %q, want %q", in, got, want)
		}
	}
}

// A service with no readiness endpoint is listed as unknown rather than dropped,
// so "not checked" cannot be read as "checked and fine".
func TestCheckServicesListsAServiceWithoutReadinessAsUnknown(t *testing.T) {
	restore := swapSpec(ApiYaml{
		Services:       map[string]Service{"cm-thing": {BaseURL: "http://thing:1", Version: "0.1.0"}},
		ServiceActions: map[string]map[string]Spec{"cm-thing": {"GetAllNs": {Method: "get", ResourcePath: "/ns"}}},
	})
	defer restore()

	result := checkServices(newContext(), time.Now())

	if len(result.Items) != 1 {
		t.Fatalf("got %d items, want 1", len(result.Items))
	}
	if result.Items[0].Status != HealthStatusUnknown {
		t.Fatalf("got %q, want %q", result.Items[0].Status, HealthStatusUnknown)
	}
	if result.Summary.Unknown != 1 || result.Summary.Total != 1 {
		t.Fatalf("summary does not match the list: %+v", result.Summary)
	}
	if result.Items[0].Version != "0.1.0" {
		t.Fatalf("the version was dropped: %+v", result.Items[0])
	}
}

func TestCheckServicesReportsWhatEachServiceSaid(t *testing.T) {
	restore := swapSpec(ApiYaml{
		Services: map[string]Service{
			"cm-up":   {BaseURL: "http://up:1"},
			"cm-down": {BaseURL: "http://down:1"},
		},
		ServiceActions: map[string]map[string]Spec{
			"cm-up":   {"GetReadyz": {Method: "get", ResourcePath: "/readyz"}},
			"cm-down": {"GetReadyz": {Method: "get", ResourcePath: "/readyz"}},
		},
	})
	defer restore()

	restoreProbe := swapProbe(func(_ context.Context, endpoint, _ string) error {
		if endpoint == "http://down:1/readyz" {
			return errors.New("responded 503")
		}
		return nil
	})
	defer restoreProbe()

	result := checkServices(newContext(), time.Now())

	if result.Summary.Healthy != 1 || result.Summary.Unhealthy != 1 {
		t.Fatalf("got %+v, want one of each", result.Summary)
	}

	byName := map[string]HealthItem{}
	for _, it := range result.Items {
		byName[it.Name] = it
	}
	if byName["cm-down"].Message != "responded 503" {
		t.Fatalf("the reason was lost: %+v", byName["cm-down"])
	}
	if byName["cm-up"].Message != "" {
		t.Fatalf("a healthy service carried a message: %+v", byName["cm-up"])
	}
	if byName["cm-up"].Endpoint != "http://up:1/readyz" {
		t.Fatalf("the endpoint asked was not reported: %+v", byName["cm-up"])
	}
}

// The list is sorted so a screen does not reshuffle between refreshes.
func TestCheckServicesSortsByName(t *testing.T) {
	restore := swapSpec(ApiYaml{
		Services: map[string]Service{
			"cm-b": {BaseURL: "http://b:1"},
			"cm-a": {BaseURL: "http://a:1"},
			"cm-c": {BaseURL: "http://c:1"},
		},
		ServiceActions: map[string]map[string]Spec{},
	})
	defer restore()

	result := checkServices(newContext(), time.Now())

	want := []string{"cm-a", "cm-b", "cm-c"}
	for i, name := range want {
		if result.Items[i].Name != name {
			t.Fatalf("item %d is %q, want %q", i, result.Items[i].Name, name)
		}
	}
}

func newContext() echo.Context {
	e := echo.New()
	return e.NewContext(httptest.NewRequest("POST", "/", nil), httptest.NewRecorder())
}

func swapSpec(next ApiYaml) func() {
	previous := ApiYamlSet
	ApiYamlSet = next
	return func() { ApiYamlSet = previous }
}

func swapProbe(next func(context.Context, string, string) error) func() {
	previous := probe
	probe = next
	return func() { probe = previous }
}
