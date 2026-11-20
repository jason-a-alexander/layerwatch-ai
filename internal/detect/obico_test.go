package detect

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
)

type noFrames struct{}

func (noFrames) Publish([]byte) (string, func(), error) { return "", func() {}, nil }

func TestObicoCheckReadsTheHealthEndpoint(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "Bearer good" {
			w.WriteHeader(http.StatusUnauthorized)

			return
		}

		if r.URL.Path != "/hc/" {
			w.WriteHeader(http.StatusNotFound)

			return
		}

		_, _ = w.Write([]byte("ok"))
	}))
	defer server.Close()

	good, _ := NewObico(server.URL, "good", noFrames{}, nil)
	if err := good.Check(context.Background()); err != nil {
		t.Fatalf("a healthy server: %v", err)
	}

	bad, _ := NewObico(server.URL, "bad", noFrames{}, nil)
	if err := bad.Check(context.Background()); err == nil {
		t.Fatal("a wrong token passed the check")
	}
}
