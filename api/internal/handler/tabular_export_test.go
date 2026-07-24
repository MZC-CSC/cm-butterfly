package handler

import (
	"bytes"
	"testing"
)

func sampleConnections() []TabularExportConnection {
	return []TabularExportConnection{
		{Name: "web-01", Description: "front server", IPAddress: "10.0.0.1", SSHPort: "22"},
		{Name: "db-01", Description: "database", IPAddress: "10.0.0.2", SSHPort: "2222"},
	}
}

func TestBuildConnectionCSVHeaderMatchesImportTemplate(t *testing.T) {
	raw, err := buildConnectionCSV(sampleConnections())
	if err != nil {
		t.Fatalf("buildConnectionCSV returned an error: %v", err)
	}

	res, err := parseTabular("export.csv", raw)
	if err != nil {
		t.Fatalf("the exported file could not be parsed back: %v", err)
	}

	if len(res.Headers) != len(exportColumns) {
		t.Fatalf("header count = %d, want %d", len(res.Headers), len(exportColumns))
	}
	for i, want := range exportColumns {
		if res.Headers[i] != want {
			t.Errorf("header[%d] = %q, want %q", i, res.Headers[i], want)
		}
	}
}

func TestBuildConnectionCSVLeavesEncryptedColumnsEmpty(t *testing.T) {
	raw, err := buildConnectionCSV(sampleConnections())
	if err != nil {
		t.Fatalf("buildConnectionCSV returned an error: %v", err)
	}

	res, err := parseTabular("export.csv", raw)
	if err != nil {
		t.Fatalf("the exported file could not be parsed back: %v", err)
	}

	for _, row := range res.Rows {
		for column := range encryptedColumns {
			if value := row.Data[column]; value != "" {
				t.Errorf("row %d column %q = %q, want an empty value", row.Index, column, value)
			}
		}
	}
}

// The exported file has to survive the importer, otherwise the two directions
// have drifted apart. This is the check that catches that.
func TestBuildConnectionCSVRoundTripsThroughTheImporter(t *testing.T) {
	connections := []TabularExportConnection{
		{Name: "web,01", Description: "has a comma", IPAddress: "10.0.0.1", SSHPort: "22"},
		{Name: "db\"01", Description: "has a quote", IPAddress: "10.0.0.2", SSHPort: "22"},
		{Name: "app-01", Description: "line one\nline two", IPAddress: "10.0.0.3", SSHPort: "22"},
		// Multi-byte UTF-8, to prove the byte order mark does not corrupt
		// non-ASCII names on the way out and back in again.
		{Name: "wéb-ürsprung-01", Description: "años de café", IPAddress: "10.0.0.4", SSHPort: "22"},
	}

	raw, err := buildConnectionCSV(connections)
	if err != nil {
		t.Fatalf("buildConnectionCSV returned an error: %v", err)
	}

	res, err := parseTabular("export.csv", raw)
	if err != nil {
		t.Fatalf("the exported file could not be parsed back: %v", err)
	}
	if len(res.Rows) != len(connections) {
		t.Fatalf("row count = %d, want %d", len(res.Rows), len(connections))
	}

	for i, want := range connections {
		got := res.Rows[i].Data
		if got["name"] != want.Name {
			t.Errorf("row %d name = %q, want %q", i+1, got["name"], want.Name)
		}
		if got["description"] != want.Description {
			t.Errorf("row %d description = %q, want %q", i+1, got["description"], want.Description)
		}
		if got["ip_address"] != want.IPAddress {
			t.Errorf("row %d ip_address = %q, want %q", i+1, got["ip_address"], want.IPAddress)
		}
		if got["ssh_port"] != want.SSHPort {
			t.Errorf("row %d ssh_port = %q, want %q", i+1, got["ssh_port"], want.SSHPort)
		}
	}
}

func TestBuildConnectionCSVStartsWithBOM(t *testing.T) {
	raw, err := buildConnectionCSV(sampleConnections())
	if err != nil {
		t.Fatalf("buildConnectionCSV returned an error: %v", err)
	}
	if !bytes.HasPrefix(raw, []byte{0xEF, 0xBB, 0xBF}) {
		t.Error("the exported file does not start with a UTF-8 byte order mark")
	}
}

// A caller cannot smuggle credentials into the file: the request type has no
// field for them, so the writer always emits empty values.
func TestBuildConnectionCSVAlwaysEmitsEveryColumn(t *testing.T) {
	raw, err := buildConnectionCSV([]TabularExportConnection{{Name: "only-name"}})
	if err != nil {
		t.Fatalf("buildConnectionCSV returned an error: %v", err)
	}

	res, err := parseTabular("export.csv", raw)
	if err != nil {
		t.Fatalf("the exported file could not be parsed back: %v", err)
	}
	if len(res.Rows) != 1 {
		t.Fatalf("row count = %d, want 1", len(res.Rows))
	}
	for _, column := range exportColumns {
		if _, ok := res.Rows[0].Data[column]; !ok {
			t.Errorf("column %q is missing from the exported row", column)
		}
	}
}
