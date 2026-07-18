package handler

import (
	"bytes"
	"os"
	"strings"
	"testing"

	"github.com/xuri/excelize/v2"
)

const csvHeader = "name,description,ip_address,ssh_port,user,password,private_key\n"

func parseCSVString(t *testing.T, body string) *TabularImportResult {
	t.Helper()
	res, err := parseTabular("import.csv", []byte(body))
	if err != nil {
		t.Fatalf("unexpected parse failure: %v", err)
	}
	return res
}

// The previous line-splitting parser shifted every column after a quoted comma,
// corrupting data without reporting anything.
func TestParseCSVKeepsQuotedComma(t *testing.T) {
	res := parseCSVString(t, csvHeader+
		`web-01,"seoul, rack 3",10.0.0.1,22,ubuntu,pw,`+"\n")

	if got := len(res.Rows); got != 1 {
		t.Fatalf("row count = %d, want 1", got)
	}
	row := res.Rows[0].Data
	if row["description"] != "seoul, rack 3" {
		t.Errorf("description = %q, want %q", row["description"], "seoul, rack 3")
	}
	if row["ip_address"] != "10.0.0.1" {
		t.Errorf("ip_address = %q, want columns not to shift", row["ip_address"])
	}
}

// A PEM key spans multiple lines. Splitting on newlines shredded it into rows.
func TestParseCSVKeepsEmbeddedNewline(t *testing.T) {
	key := "«BEGIN line»\nbody line 1\nbody line 2\n«END line»"
	res := parseCSVString(t, csvHeader+
		`web-01,desc,10.0.0.1,22,ubuntu,,"`+key+`"`+"\n")

	if got := len(res.Rows); got != 1 {
		t.Fatalf("row count = %d, want 1 (newlines must not split rows)", got)
	}
	if got := res.Rows[0].Data["private_key"]; got != key {
		t.Errorf("private_key = %q, want the key preserved verbatim", got)
	}
}

// Our own template is written with a BOM, so round-tripping it must work.
func TestParseCSVStripsBOM(t *testing.T) {
	res := parseCSVString(t, "\uFEFF"+csvHeader+
		"web-01,desc,10.0.0.1,22,ubuntu,pw,\n")

	if _, ok := res.Rows[0].Data["name"]; !ok {
		t.Fatalf("headers = %v, want a clean 'name' key", res.Headers)
	}
	if res.Rows[0].Data["name"] != "web-01" {
		t.Errorf("name = %q, want web-01", res.Rows[0].Data["name"])
	}
}

func TestParseCSVSkipsBlankLines(t *testing.T) {
	res := parseCSVString(t, csvHeader+
		"web-01,desc,10.0.0.1,22,ubuntu,pw,\n\n\nweb-02,desc,10.0.0.2,22,ubuntu,pw,\n")

	if got := len(res.Rows); got != 2 {
		t.Fatalf("row count = %d, want 2", got)
	}
	if res.Rows[1].Index != 2 {
		t.Errorf("second row index = %d, want 2", res.Rows[1].Index)
	}
}

func TestParseCSVRejectsHeaderOnly(t *testing.T) {
	_, err := parseTabular("import.csv", []byte(csvHeader))
	if err == nil {
		t.Fatal("expected a file problem for a header-only file")
	}
	if !isFileProblem(err) {
		t.Errorf("error = %T, want a user-fixable file problem", err)
	}
	// The message must tell the user what to do, not just what is wrong.
	if !strings.Contains(err.Error(), "one row per server") {
		t.Errorf("message = %q, want guidance on how to fix it", err.Error())
	}
}

func TestParseCSVReportsUnclosedQuote(t *testing.T) {
	_, err := parseTabular("import.csv", []byte(csvHeader+
		`web-01,"never closed,10.0.0.1,22,ubuntu,pw,`+"\n"))
	if err == nil {
		t.Fatal("expected a file problem for an unclosed quote")
	}
	if !strings.Contains(err.Error(), "quoted value") {
		t.Errorf("message = %q, want a hint about the unclosed quote", err.Error())
	}
}

// Excel and CSV must produce identical results — that is the whole point of
// treating them as one tabular format.
func TestParseExcelMatchesCSV(t *testing.T) {
	f := excelize.NewFile()
	defer func() { _ = f.Close() }()
	sheet := f.GetSheetName(0)

	headers := []string{"name", "description", "ip_address", "ssh_port", "user", "password", "private_key"}
	values := []string{"web-01", "seoul, rack 3", "10.0.0.1", "22", "ubuntu", "pw", "«BEGIN line»\nbody line 1\n«END line»"}
	for i, h := range headers {
		cell, _ := excelize.CoordinatesToCellName(i+1, 1)
		_ = f.SetCellValue(sheet, cell, h)
		cell, _ = excelize.CoordinatesToCellName(i+1, 2)
		_ = f.SetCellValue(sheet, cell, values[i])
	}

	var buf bytes.Buffer
	if err := f.Write(&buf); err != nil {
		t.Fatalf("failed to build workbook: %v", err)
	}

	res, err := parseTabular("import.xlsx", buf.Bytes())
	if err != nil {
		t.Fatalf("unexpected parse failure: %v", err)
	}
	if res.Format != "xlsx" {
		t.Errorf("format = %q, want xlsx", res.Format)
	}
	if got := len(res.Rows); got != 1 {
		t.Fatalf("row count = %d, want 1", got)
	}
	for i, h := range headers {
		if got := res.Rows[0].Data[h]; got != values[i] {
			t.Errorf("%s = %q, want %q", h, got, values[i])
		}
	}
}

// Format detection must not depend on the file name alone.
func TestDetectFormatSniffsContent(t *testing.T) {
	if got := detectFormat("", []byte{0x50, 0x4B, 0x03, 0x04, 0x00}); got != "xlsx" {
		t.Errorf("zip signature detected as %q, want xlsx", got)
	}
	if got := detectFormat("", []byte{0xD0, 0xCF, 0x11, 0xE0, 0x00}); got != "xls" {
		t.Errorf("legacy signature detected as %q, want xls", got)
	}
	if got := detectFormat("data.CSV", []byte("a,b\n1,2\n")); got != "csv" {
		t.Errorf("uppercase extension detected as %q, want csv", got)
	}
}

// The legacy binary format needs actionable guidance, not a vague failure.
func TestParseLegacyXlsGuidesUser(t *testing.T) {
	_, err := parseTabular("old.xls", []byte{0xD0, 0xCF, 0x11, 0xE0})
	if err == nil {
		t.Fatal("expected a file problem for .xls")
	}
	if !strings.Contains(err.Error(), ".xlsx") {
		t.Errorf("message = %q, want it to suggest saving as .xlsx", err.Error())
	}
}

func TestParseCorruptWorkbookIsFileProblem(t *testing.T) {
	// A zip signature with garbage behind it: opens as xlsx, fails to read.
	raw := append([]byte{0x50, 0x4B, 0x03, 0x04}, []byte("not really a workbook")...)
	_, err := parseTabular("broken.xlsx", raw)
	if err == nil {
		t.Fatal("expected a file problem for a corrupt workbook")
	}
	if !isFileProblem(err) {
		t.Errorf("error = %T, want a user-fixable file problem", err)
	}
}

func TestBuildResultFlagsRaggedRow(t *testing.T) {
	res := parseCSVString(t, "name,ip_address\nweb-01,10.0.0.1,extra\n")
	if len(res.FileErrors) == 0 {
		t.Error("expected a file error for a row with more values than columns")
	}
}

func isFileProblem(err error) bool {
	_, ok := err.(*fileProblem)
	return ok
}

// The samples in the format guide must actually parse. A guide that has never
// been run is a guide that will be wrong.
func TestDocumentedSamplesParse(t *testing.T) {
	basic, err := os.ReadFile("testdata/sample-basic.csv")
	if err != nil {
		t.Fatalf("failed to read sample: %v", err)
	}
	res, err := parseTabular("sample-basic.csv", basic)
	if err != nil {
		t.Fatalf("documented basic sample failed to parse: %v", err)
	}
	if got := len(res.Rows); got != 3 {
		t.Fatalf("basic sample rows = %d, want 3", got)
	}
	if got := res.Rows[1].Data["description"]; got != "서울 IDC, 3랙" {
		t.Errorf("quoted comma sample = %q, want the comma preserved", got)
	}
	if got := res.Rows[2].Data["ssh_port"]; got != "2222" {
		t.Errorf("ssh_port = %q, want 2222", got)
	}

	keyed, err := os.ReadFile("testdata/sample-privatekey.csv")
	if err != nil {
		t.Fatalf("failed to read sample: %v", err)
	}
	res, err = parseTabular("sample-privatekey.csv", keyed)
	if err != nil {
		t.Fatalf("documented private key sample failed to parse: %v", err)
	}
	if got := len(res.Rows); got != 1 {
		t.Fatalf("private key sample rows = %d, want 1 (real newlines must stay in one row)", got)
	}
	key := res.Rows[0].Data["private_key"]
	if !strings.HasPrefix(key, "«BEGIN line»\n") {
		t.Errorf("private_key lost its line breaks: %q", key)
	}
	if !strings.HasSuffix(key, "\n«END line»") {
		t.Errorf("private_key truncated: %q", key)
	}
	if strings.Contains(key, `\n`) {
		t.Error("private_key contains a literal backslash-n; real newlines were expected")
	}
}
