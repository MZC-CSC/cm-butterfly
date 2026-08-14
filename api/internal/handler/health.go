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
	"os"
	"sort"
	"strconv"
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

// The console's own entry in the specification.
//
// It is left out of the answer: this check runs inside it, so if it were not
// answering there would be no answer at all. Listing it adds a row that can only
// ever say "not checked" and pushes the services that can actually fail down the
// screen.
const consoleServiceName = "cm-butterfly-api"

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

// HealthSettings is how often to look and how many failures in a row count as a
// failure.
//
// It is answered here rather than compiled into the console because the console
// ships as a static build: a value baked in at build time cannot be changed by
// whoever runs the lineup, which is precisely who needs to change it. A demo box
// restarted all day and a long-running installation want different answers.
type HealthSettings struct {
	IntervalSec      int `json:"intervalSec"`
	FailureThreshold int `json:"failureThreshold"`
}

// HealthResult is what the endpoint answers.
type HealthResult struct {
	Summary  HealthSummary  `json:"summary"`
	Items    []HealthItem   `json:"items"`
	Settings HealthSettings `json:"settings"`
}

const (
	defaultHealthIntervalSec      = 300
	defaultHealthFailureThreshold = 2
)

// envPositiveInt reads a positive integer from the environment, or returns the
// fallback. A value that is missing, empty or nonsense falls back rather than
// stopping the server: getting this wrong should not take the console down.
func envPositiveInt(name string, fallback int) int {
	raw, ok := os.LookupEnv(name)
	if !ok {
		return fallback
	}
	n, err := strconv.Atoi(strings.TrimSpace(raw))
	if err != nil || n <= 0 {
		return fallback
	}
	return n
}

func healthSettings() HealthSettings {
	return HealthSettings{
		IntervalSec:      envPositiveInt("HEALTH_CHECK_INTERVAL_SEC", defaultHealthIntervalSec),
		FailureThreshold: envPositiveInt("HEALTH_CHECK_FAILURE_THRESHOLD", defaultHealthFailureThreshold),
	}
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

/*
swaggerSource is the address the specification was taken from, as an address that
can actually be opened.

The release entry is written with a `{release}` placeholder, which is what
cm-mayfly fills in when it generates the operations. Handing that string to the
screen unchanged gives a link that 404s on click, which is worse than no link —
it looks like the specification is missing rather than like the address was never
completed.

Which release to fill in is in the version label, written as `pinned(spec)`:
`0.12.42(latest)` was generated from main, `0.6.0(0.6.0)` from that tag. So a
label ending in `latest` takes the latest address, and anything else fills the
placeholder with that tag.
*/
func swaggerSource(service Service) string {
	if service.Swagger == nil {
		return ""
	}

	spec := specRefFromVersion(service.Version)
	if spec == "" || strings.EqualFold(spec, "latest") {
		if v := service.Swagger["latest"]; v != "" {
			return v
		}
		return strings.ReplaceAll(service.Swagger["release"], "{release}", "main")
	}

	release := service.Swagger["release"]
	if release == "" {
		return service.Swagger["latest"]
	}
	if !strings.HasPrefix(spec, "v") {
		spec = "v" + spec
	}
	return strings.ReplaceAll(release, "{release}", spec)
}

// specRefFromVersion pulls the part in brackets out of a version label such as
// `0.12.42(latest)`. Empty when the label carries none.
func specRefFromVersion(version string) string {
	open := strings.LastIndex(version, "(")
	closeAt := strings.LastIndex(version, ")")
	if open < 0 || closeAt < open {
		return ""
	}
	return strings.TrimSpace(version[open+1 : closeAt])
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
		if strings.EqualFold(name, consoleServiceName) {
			continue
		}
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

	return HealthResult{Summary: summary, Items: items, Settings: healthSettings()}
}

// HealthHandler serves the linked services' readiness.
type HealthHandler struct{}

func NewHealthHandler() *HealthHandler { return &HealthHandler{} }

// Subsystems answers with every linked service and what it said.
func (h *HealthHandler) Subsystems(c echo.Context) error {
	return c.JSON(http.StatusOK, checkServices(c, time.Now()))
}
