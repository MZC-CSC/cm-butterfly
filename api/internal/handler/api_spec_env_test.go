package handler

import (
	"strings"
	"testing"
)

// withEnv swaps the environment lookup for the duration of a test.
func withEnv(t *testing.T, values map[string]string) {
	t.Helper()
	prev := lookupEnv
	lookupEnv = func(key string) (string, bool) {
		v, ok := values[key]
		return v, ok
	}
	t.Cleanup(func() { lookupEnv = prev })
}

// A whole value of the form ${VAR} is a reference; everything else is a
// literal. A password may legitimately contain braces, so partial matches must
// not be treated as references.
func TestEnvRefName(t *testing.T) {
	cases := map[string]string{
		"${SPIDER_USERNAME}":     "SPIDER_USERNAME",
		"  ${TB_API_PASSWORD}":   "TB_API_PASSWORD",
		"${_leading_underscore}": "_leading_underscore",
		"default":                "",
		"":                       "",
		"pre${VAR}":              "",
		"${VAR}post":             "",
		"${VAR} ${OTHER}":        "",
		"${1STARTS_WITH_DIGIT}":  "",
		"${has-a-dash}":          "",
		"$VAR":                   "",
		"{VAR}":                  "",
	}
	for in, want := range cases {
		if got := envRefName(in); got != want {
			t.Errorf("envRefName(%q) = %q, want %q", in, got, want)
		}
	}
}

// References are replaced with their environment values and literals are left
// as they are.
func TestResolveAuthEnvSubstitutes(t *testing.T) {
	withEnv(t, map[string]string{"SPIDER_USERNAME": "spider-user", "SPIDER_PASSWORD": "s3cret"})

	got, missing := resolveAuthEnv(map[string]Service{
		"cb-spider": {Auth: Auth{Type: "basic", Username: "${SPIDER_USERNAME}", Password: "${SPIDER_PASSWORD}"}},
		"cm-beetle": {Auth: Auth{Type: "basic", Username: "literal-user", Password: "literal-pass"}},
	})
	if len(missing) != 0 {
		t.Fatalf("nothing should be missing, got %v", missing)
	}
	if u := got["cb-spider"].Auth.Username; u != "spider-user" {
		t.Errorf("cb-spider username = %q, want the environment value", u)
	}
	if p := got["cb-spider"].Auth.Password; p != "s3cret" {
		t.Errorf("cb-spider password = %q, want the environment value", p)
	}
	if u := got["cm-beetle"].Auth.Username; u != "literal-user" {
		t.Errorf("a literal must survive untouched, got %q", u)
	}
}

// An unresolved reference is reported rather than quietly becoming empty. This
// is the whole point of the change: a default standing in for a missing
// credential is what let the console drift away from the deployment's .env.
func TestResolveAuthEnvReportsMissing(t *testing.T) {
	withEnv(t, map[string]string{"TB_API_USERNAME": "tb-user", "SPIDER_PASSWORD": ""})

	_, missing := resolveAuthEnv(map[string]Service{
		"cb-spider":    {Auth: Auth{Type: "basic", Username: "${SPIDER_USERNAME}", Password: "${SPIDER_PASSWORD}"}},
		"cb-tumblebug": {Auth: Auth{Type: "basic", Username: "${TB_API_USERNAME}", Password: "${TB_API_PASSWORD}"}},
	})

	want := []string{"SPIDER_PASSWORD", "SPIDER_USERNAME", "TB_API_PASSWORD"}
	if len(missing) != len(want) {
		t.Fatalf("missing = %v, want %v", missing, want)
	}
	for i := range want {
		if missing[i] != want[i] {
			t.Fatalf("missing = %v, want %v (sorted)", missing, want)
		}
	}
}

// A variable that is set but empty counts as missing. An empty credential
// produces the same silent 401 as an unset one.
func TestResolveAuthEnvTreatsEmptyAsMissing(t *testing.T) {
	withEnv(t, map[string]string{"SPIDER_USERNAME": "", "SPIDER_PASSWORD": "s3cret"})

	_, missing := resolveAuthEnv(map[string]Service{
		"cb-spider": {Auth: Auth{Type: "basic", Username: "${SPIDER_USERNAME}", Password: "${SPIDER_PASSWORD}"}},
	})
	if len(missing) != 1 || missing[0] != "SPIDER_USERNAME" {
		t.Fatalf("missing = %v, want [SPIDER_USERNAME]", missing)
	}
}

// Services that send no credentials are left alone. cm-butterfly takes bearer
// tokens from the request rather than from this file, so an unresolved
// reference there cannot break a call and must not stop startup.
func TestResolveAuthEnvSkipsNonBasic(t *testing.T) {
	withEnv(t, map[string]string{})

	got, missing := resolveAuthEnv(map[string]Service{
		"cm-cicada":    {Auth: Auth{Type: "none"}},
		"cm-honeybee":  {Auth: Auth{Type: ""}},
		"some-service": {Auth: Auth{Type: "bearer", Username: "${NEVER_SET}"}},
	})
	if len(missing) != 0 {
		t.Fatalf("nothing should be required, got %v", missing)
	}
	if u := got["some-service"].Auth.Username; u != "${NEVER_SET}" {
		t.Errorf("a skipped service must be untouched, got %q", u)
	}
}

// The type is matched without regard to case or surrounding spaces, so a file
// written as "Basic " still has its credentials resolved.
func TestSendsCredentials(t *testing.T) {
	for _, in := range []string{"basic", "Basic", " BASIC "} {
		if !sendsCredentials(in) {
			t.Errorf("sendsCredentials(%q) = false, want true", in)
		}
	}
	for _, in := range []string{"none", "", "bearer", "Bearer"} {
		if sendsCredentials(in) {
			t.Errorf("sendsCredentials(%q) = true, want false", in)
		}
	}
}

// The startup error has to be actionable on its own — it names every variable
// and says where to set them.
func TestMissingEnvErrorNamesEveryVariable(t *testing.T) {
	err := missingEnvError([]string{"SPIDER_PASSWORD", "TB_API_USERNAME"})
	msg := err.Error()
	for _, want := range []string{"SPIDER_PASSWORD", "TB_API_USERNAME", ".env"} {
		if !strings.Contains(msg, want) {
			t.Errorf("error message is missing %q: %s", want, msg)
		}
	}
}
