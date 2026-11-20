// The codes this module refuses a caller with.
package main

import (
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/prusa3d/prusa-connect/sdk/fault"
)

// faultDomain is this module's namespace, which the host derives from the Go
// module path in go.mod.
//
//nolint:gochecknoglobals // a domain built once at start-up.
var faultDomain = mustDomain(namespace)

// namespace is github.com/leotrax3d/layerwatch-ai
// as the host derives it. TestTheFaultDomainIsTheDerivedNamespace holds the two together.
const namespace = "com.github.aux.leotrax3d.layerwatch-ai"

//nolint:gochecknoglobals // definitions built once at start-up.
var (
	// RouteNotFound is a path this module does not serve.
	RouteNotFound = fault.Register(faultDomain, "ROUTE_NOT_FOUND", http.StatusNotFound, fault.Document(
		"This module does not serve that path",
		"Read openapi.json. Every path in it is relative to the mount the operator gave this module.",
		fault.RetryNever,
		fault.ShowDetail,
		"path",
	))

	// PrinterNotWatched is a reset for a printer no camera has reported on.
	PrinterNotWatched = fault.Register(faultDomain, "PRINTER_NOT_WATCHED", http.StatusNotFound, fault.Document(
		"No camera of this printer has sent a snapshot yet",
		"Switch on periodic capture for the printer's camera, then try again once a snapshot arrived.",
		fault.RetryAllowed,
		fault.ShowDetail,
		"printer",
	))

	// DetectorFailed is a test analysis the detector could not finish.
	DetectorFailed = fault.Register(faultDomain, "DETECTOR_FAILED", http.StatusBadGateway, fault.Document(
		"The detector could not analyse the picture",
		"Check that the Obico ML API runs, that obico_url and obico_token are right and that frame_base_url reaches this module's frames port.",
		fault.RetryAllowed,
		fault.ShowDetail,
		"reason",
	))

	// IncidentsUnavailable is a record store that did not answer.
	IncidentsUnavailable = fault.Register(faultDomain, "INCIDENTS_UNAVAILABLE", http.StatusServiceUnavailable, fault.Document(
		"The incident history could not be read",
		"Try again in a moment. The host log has the cause.",
		fault.RetryAllowed,
		fault.ShowDetail,
	))
)

func mustDomain(name string) fault.Domain {
	domain, err := fault.NewDomain(name)
	if err != nil {
		panic(fmt.Sprintf("layerwatch-ai: %s is not a fault domain: %v", name, err))
	}

	return domain
}

// refuse writes one refusal as RFC 9457 frames it.
func refuse(w http.ResponseWriter, r *http.Request, raised *fault.Fault) {
	problem := raised.ProblemJSON(r.URL.Path)

	w.Header().Set("Content-Type", "application/problem+json")
	w.WriteHeader(problem.Status)

	_ = json.NewEncoder(w).Encode(problem)
}
