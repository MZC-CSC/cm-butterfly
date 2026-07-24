package handler

import (
	"bytes"
	"encoding/base64"
	"encoding/csv"
	"fmt"
	"strings"

	"api/internal/util/response"

	"github.com/labstack/echo/v4"
	"github.com/xuri/excelize/v2"
)

// exportSheetName is the single sheet the Excel export writes into.
const exportSheetName = "connections"

// maxExportRows mirrors the import limit so both directions agree on how much
// data is reasonable in one file.
const maxExportRows = 1000

// exportColumns is the column contract shared with the import template. The
// order must stay identical to the template so an exported file can be fed
// straight back into the importer.
var exportColumns = []string{
	"name",
	"description",
	"ip_address",
	"ssh_port",
	"user",
	"password",
	"private_key",
}

// encryptedColumns are written as headers with empty values. The connected
// system returns these fields as ciphertext only, so there is no plaintext to
// export. Writing the ciphertext would leak the values and also break a
// re-import, because the importer would treat the ciphertext as a real
// credential.
var encryptedColumns = map[string]bool{
	"user":        true,
	"password":    true,
	"private_key": true,
}

// TabularExportConnection is one connection to write out. The encrypted columns
// are deliberately absent from this struct: the server never receives them, so
// they cannot reach the file even if the console sends them by mistake.
type TabularExportConnection struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	IPAddress   string `json:"ip_address"`
	SSHPort     string `json:"ssh_port"`
}

// TabularExportRequest carries the connections the user selected.
type TabularExportRequest struct {
	// Format selects the output form: "csv" or "xlsx". An empty value means csv.
	Format      string                    `json:"format"`
	Connections []TabularExportConnection `json:"connections"`
}

// TabularExportResult carries the generated file.
type TabularExportResult struct {
	Format string `json:"format"`
	// ContentBase64 holds the file bytes, matching how the import endpoint
	// receives binary content. Keeping it base64 means the response shape does
	// not change if a binary format such as xlsx is added later.
	ContentBase64 string `json:"contentBase64"`
}

// ExportTabularConnections builds a file from the selected connections using the
// same layout the importer reads. Generating it here, next to the parser, keeps
// the column contract in one place so the two directions cannot drift apart.
func ExportTabularConnections(c echo.Context) error {
	req := new(TabularExportRequest)
	if err := c.Bind(req); err != nil {
		return response.BadRequest(c, "Invalid request body.")
	}

	format := strings.ToLower(strings.TrimSpace(req.Format))
	if format == "" {
		format = "csv"
	}
	if format != "csv" && format != "xlsx" {
		return response.BadRequest(c, fmt.Sprintf("Unsupported export format: %s", req.Format))
	}
	if len(req.Connections) == 0 {
		return response.BadRequest(c, "Select at least one connection to export.")
	}
	if len(req.Connections) > maxExportRows {
		return response.BadRequest(c, fmt.Sprintf("Too many connections to export. (limit: %d)", maxExportRows))
	}

	raw, err := buildExportFile(format, req.Connections)
	if err != nil {
		return response.InternalServerError(c, "Failed to build the export file.")
	}

	return response.Success(c, &TabularExportResult{
		Format:        format,
		ContentBase64: base64.StdEncoding.EncodeToString(raw),
	})
}

// buildExportFile writes the connections in the requested format. Both share
// exportColumns and the empty-encrypted-column rule; only the container differs.
func buildExportFile(format string, connections []TabularExportConnection) ([]byte, error) {
	if format == "xlsx" {
		return buildConnectionXLSX(connections)
	}
	return buildConnectionCSV(connections)
}

// buildConnectionCSV writes the header and one row per connection. encoding/csv
// quotes values containing commas, quotes or newlines, so the result survives a
// round trip through the import parser.
func buildConnectionCSV(connections []TabularExportConnection) ([]byte, error) {
	var buf bytes.Buffer

	// Excel needs the byte order mark to read UTF-8 correctly, and our own
	// template carries one. The import parser strips it, so it does not
	// interfere when the file comes back.
	buf.Write([]byte{0xEF, 0xBB, 0xBF})

	w := csv.NewWriter(&buf)
	if err := w.Write(exportColumns); err != nil {
		return nil, err
	}

	for _, conn := range connections {
		record := make([]string, 0, len(exportColumns))
		for _, column := range exportColumns {
			record = append(record, exportValue(conn, column))
		}
		if err := w.Write(record); err != nil {
			return nil, err
		}
	}

	w.Flush()
	if err := w.Error(); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

// buildConnectionXLSX writes the same header and rows into an Excel workbook.
// Users who find CSV awkward to edit (encoding, auto-formatting) get a file
// Excel opens cleanly. The column contract is identical to the CSV path.
func buildConnectionXLSX(connections []TabularExportConnection) ([]byte, error) {
	f := excelize.NewFile()
	defer func() { _ = f.Close() }()

	index, err := f.NewSheet(exportSheetName)
	if err != nil {
		return nil, err
	}
	f.SetActiveSheet(index)
	// NewFile seeds a default "Sheet1"; drop it so the importer reads ours first.
	_ = f.DeleteSheet("Sheet1")

	if err := writeXLSXRow(f, 1, exportColumns); err != nil {
		return nil, err
	}
	for i, conn := range connections {
		record := make([]string, 0, len(exportColumns))
		for _, column := range exportColumns {
			record = append(record, exportValue(conn, column))
		}
		if err := writeXLSXRow(f, i+2, record); err != nil {
			return nil, err
		}
	}

	buf, err := f.WriteToBuffer()
	if err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

func writeXLSXRow(f *excelize.File, row int, values []string) error {
	for col, value := range values {
		cell, err := excelize.CoordinatesToCellName(col+1, row)
		if err != nil {
			return err
		}
		if err := f.SetCellStr(exportSheetName, cell, value); err != nil {
			return err
		}
	}
	return nil
}

// exportValue maps a column name onto the connection. Encrypted columns always
// come back empty, whatever the caller sent.
func exportValue(conn TabularExportConnection, column string) string {
	if encryptedColumns[column] {
		return ""
	}
	switch column {
	case "name":
		return conn.Name
	case "description":
		return conn.Description
	case "ip_address":
		return conn.IPAddress
	case "ssh_port":
		return conn.SSHPort
	default:
		return ""
	}
}
