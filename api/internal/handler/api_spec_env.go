package handler

// Environment references in api.yaml credentials.
//
// The proxy sends whatever api.yaml carries for auth.username / auth.password.
// Those values used to be literals, which meant the console kept sending
// default:default while the deployment's .env said something else — the two
// drifted apart silently and the only symptom was a 401 that looked like "the
// screen does not load".
//
// A credential may now be written as ${VAR} and is read from the process
// environment at startup. Under docker compose the values come from the single
// shared .env; running the console on its own, they come from the shell.
//
// There is deliberately no fallback. A ${VAR} that resolves to nothing stops
// the server with the variable named, because a default that quietly stands in
// for a missing credential is the failure this change exists to remove.

import (
	"fmt"
	"os"
	"regexp"
	"sort"
	"strings"
)

// envRefPattern matches a whole value that is a single ${VAR} reference.
// Anything else is taken as a literal, so a password that happens to contain a
// brace is left alone.
var envRefPattern = regexp.MustCompile(`^\$\{([A-Za-z_][A-Za-z0-9_]*)\}$`)

// envRefName returns the variable a value refers to, or "" when the value is a
// literal.
func envRefName(value string) string {
	m := envRefPattern.FindStringSubmatch(strings.TrimSpace(value))
	if m == nil {
		return ""
	}
	return m[1]
}

// lookupEnv is os.LookupEnv, indirected so tests can supply an environment.
var lookupEnv = os.LookupEnv

// resolveAuthEnv replaces the ${VAR} references in every service's credentials
// with their environment values, and reports the ones that resolve to nothing.
//
// Only auth.username and auth.password are resolved. baseurl stays literal:
// it is part of how the deployment is wired rather than a secret, and making it
// overridable is a separate decision.
//
// A service that authenticates with `type: none` is skipped — it sends no
// credentials, so an unresolved reference there cannot break a call.
func resolveAuthEnv(services map[string]Service) (map[string]Service, []string) {
	missing := map[string]bool{}
	out := make(map[string]Service, len(services))

	for name, svc := range services {
		if !sendsCredentials(svc.Auth.Type) {
			out[name] = svc
			continue
		}
		svc.Auth.Username = resolveOne(svc.Auth.Username, missing)
		svc.Auth.Password = resolveOne(svc.Auth.Password, missing)
		out[name] = svc
	}

	names := make([]string, 0, len(missing))
	for n := range missing {
		names = append(names, n)
	}
	sort.Strings(names)
	return out, names
}

// sendsCredentials reports whether the auth type builds a header from the
// username and password in api.yaml. `bearer` takes its token from the request
// context rather than the file, so it needs nothing resolved here.
func sendsCredentials(authType string) bool {
	return strings.EqualFold(strings.TrimSpace(authType), "basic")
}

// resolveOne returns the environment value for a ${VAR} reference, recording
// the name when it is unset or empty. Literals pass through untouched.
func resolveOne(value string, missing map[string]bool) string {
	name := envRefName(value)
	if name == "" {
		return value
	}
	if v, ok := lookupEnv(name); ok && v != "" {
		return v
	}
	missing[name] = true
	return ""
}

// missingEnvError explains what to set and where, so the message is actionable
// without reading the source.
func missingEnvError(names []string) error {
	return fmt.Errorf(
		"api.yaml refers to environment variables that are not set: %s. "+
			"These carry the credentials the console uses to call the subsystems, and there is no default for them. "+
			"Set them in the environment — under docker compose they come from the shared .env, and conf/.env.example lists the expected names",
		strings.Join(names, ", "))
}
