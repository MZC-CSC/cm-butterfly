package handler

// Whether the linked services are answering.
//
// The console is a front for other services, so "the console is up" says very
// little. When a screen comes back empty the question is which of the services
// behind it stopped answering, and until now the only way to find out was to
// read container logs on the host.
//
// Each service publishes a readiness endpoint. This asks all of them at once and
// reports what each one said, together with the release its operations were
// generated from — a screen that shows nothing because the service is down and
// one that shows nothing because the spec here is older than the service look
// identical otherwise.

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/labstack/echo/v4"
)

// Status values a service can be reported with.
const (
	HealthStatusHealthy   = "healthy"
	HealthStatusUnhealthy = "unhealthy"
	// A service that publishes no readiness endpoint. It is listed rather than
	// hidden, so that "not checked" is visible instead of being mistaken for
	// "checked and fine".
	HealthStatusUnknown = "unknown"
)

// How long a single service is given to answer. Short on purpose: a service that
// takes longer than this is not usable from a screen either.
const healthProbeTimeout = 5 * time.Second

// HealthItem is one service's answer.
type HealthItem struct {
	Name    string `json:"name"`
	Status  string `json:"status"`
	Version string `json:"version,omitempty"`
	// Where the specification came from, so a stale spec can be told from a
	// stale service.
	Swagger string `json:"swagger,omitempty"`
	// The endpoint that was asked, so the answer can be reproduced by hand.
	Endpoint string `json:"endpoint,omitempty"`
	// Why it is not healthy. Empty when it is.
	Message   string `json:"message,omitempty"`
	CheckedAt string `json:"checkedAt"`
}

// HealthSummary is the count behind the list, so a screen does not have to
// recount it and two screens cannot disagree.
type HealthSummary struct {
	Total     int    `json:"total"`
	Healthy   int    `json:"healthy"`
	Unhealthy int    `json:"unhealthy"`
	Unknown   int    `json:"unknown"`
	CheckedAt string `json:"checkedAt"`
}

// HealthResult is what the endpoint answers.
type HealthResult struct {
	Summary HealthSummary `json:"summary"`
	Items   []HealthItem  `json:"items"`
}

/*
readinessSpec finds the operation that asks a service whether it is ready.

The operation is looked up rather than listed here. Every service names it
differently — Health-Check-Readyz, GetReadyz, RestGetReadyz, AntServerReadiness —
and a list would have to be edited each time a service joins the lineup, which is
exactly the edit that gets forgotten. What they agree on is the path: it ends in
/readyz. That is what is matched.
*/
func readinessSpec(actions map[string]Spec) (Spec, bool) {
	var found Spec
	ok := false
	// The map has no order, so without picking deterministically the same lineup
	// could report a different endpoint between two runs.
	names := make([]string, 0, len(actions))
	for name := range actions {
		names = append(names, name)
	}
	sort.Strings(names)

	for _, name := range names {
		spec := actions[name]
		if !strings.EqualFold(spec.Method, "get") {
			continue
		}
		path := strings.TrimRight(spec.ResourcePath, "/")
		if strings.HasSuffix(strings.ToLower(path), "/readyz") || strings.EqualFold(path, "/readyz") {
			return spec, true
		}
	}
	return found, ok
}

// swaggerSource is the address the specification was taken from. The release
// entry is the one that matches a pinned version; latest is the fallback for a
// service tracking main.
func swaggerSource(service Service) string {
	if service.Swagger == nil {
		return ""
	}
	if v, ok := service.Swagger["release"]; ok && v != "" {
		return v
	}
	return service.Swagger["latest"]
}

// probe asks one service and reports what it said.
//
// It calls the service directly rather than going through the proxy: the proxy
// answers in the shape a screen expects and swallows the transport error, which
// is the very thing that has to be reported here.
var probe = func(ctx context.Context, endpoint string, auth string) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return err
	}
	if auth != "" {
		req.Header.Set("Authorization", auth)
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer func() {
		_, _ = io.Copy(io.Discard, resp.Body)
		_ = resp.Body.Close()
	}()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("responded %d", resp.StatusCode)
	}
	return nil
}

// checkServices asks every service and returns the answers, sorted by name so
// the screen does not reorder itself between refreshes.
func checkServices(c echo.Context, now time.Time) HealthResult {
	stamp := now.UTC().Format(time.RFC3339)

	names := make([]string, 0, len(ApiYamlSet.Services))
	for name := range ApiYamlSet.Services {
		names = append(names, name)
	}
	sort.Strings(names)

	items := make([]HealthItem, len(names))
	var wg sync.WaitGroup

	for i, name := range names {
		service := ApiYamlSet.Services[name]
		item := HealthItem{
			Name:      name,
			Version:   service.Version,
			Swagger:   swaggerSource(service),
			CheckedAt: stamp,
		}

		spec, found := readinessSpec(ApiYamlSet.ServiceActions[name])
		if !found {
			item.Status = HealthStatusUnknown
			item.Message = "no readiness endpoint in the specification"
			items[i] = item
			continue
		}

		endpoint := strings.TrimRight(service.BaseURL, "/") + spec.ResourcePath
		item.Endpoint = endpoint

		// The credentials are read on this goroutine: getAuth reads the request
		// context for a bearer token, and echo's context is not safe to touch
		// from several goroutines at once.
		auth, err := getAuth(c, service)
		if err != nil {
			item.Status = HealthStatusUnhealthy
			item.Message = err.Error()
			items[i] = item
			continue
		}

		wg.Add(1)
		go func(idx int, it HealthItem, endpoint, auth string) {
			defer wg.Done()

			ctx, cancel := context.WithTimeout(context.Background(), healthProbeTimeout)
			defer cancel()

			if err := probe(ctx, endpoint, auth); err != nil {
				it.Status = HealthStatusUnhealthy
				it.Message = err.Error()
			} else {
				it.Status = HealthStatusHealthy
			}
			items[idx] = it
		}(i, item, endpoint, auth)
	}

	wg.Wait()

	summary := HealthSummary{Total: len(items), CheckedAt: stamp}
	for _, it := range items {
		switch it.Status {
		case HealthStatusHealthy:
			summary.Healthy++
		case HealthStatusUnhealthy:
			summary.Unhealthy++
		default:
			summary.Unknown++
		}
	}

	return HealthResult{Summary: summary, Items: items}
}

// HealthHandler serves the linked services' readiness.
type HealthHandler struct{}

func NewHealthHandler() *HealthHandler { return &HealthHandler{} }

// Subsystems answers with every linked service and what it said.
func (h *HealthHandler) Subsystems(c echo.Context) error {
	return c.JSON(http.StatusOK, checkServices(c, time.Now()))
}
