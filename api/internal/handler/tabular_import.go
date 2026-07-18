package handler

import (
	"bytes"
	"encoding/base64"
	"encoding/csv"
	"errors"
	"fmt"
	"net/http"
	"strings"

	"api/internal/util/response"

	"github.com/labstack/echo/v4"
	"github.com/xuri/excelize/v2"
)

// Limits guard against oversized input. The connected system caps a source
// group at 200 connections, so anything far beyond that is a mistake rather
// than a legitimate import.
const (
	maxImportFileBytes = 5 << 20 // 5 MiB of decoded content
	maxImportRows      = 1000
	maxImportColumns   = 64
)

// TabularImportRequest carries the raw file. CSV arrives as text; Excel is
// binary and therefore base64 encoded. Exactly one of them must be set.
type TabularImportRequest struct {
	// FileName drives format detection and appears in messages.
	FileName string `json:"fileName"`
	// Content holds CSV text as-is.
	Content string `json:"content"`
	// ContentBase64 holds binary content (Excel) encoded as base64.
	ContentBase64 string `json:"contentBase64"`
}

// TabularImportRow is one parsed data row. Index is 1-based over data rows,
// excluding the header, so it matches what the user sees in the preview.
type TabularImportRow struct {
	Index int               `json:"index"`
	Data  map[string]string `json:"data"`
}

// TabularImportResult is the parse outcome. Validation is deliberately absent:
// this handler only turns a file into rows. Domain rules live in the console so
// that the interactive form and the import path share one set of rules.
type TabularImportResult struct {
	Format     string             `json:"format"`
	Headers    []string           `json:"headers"`
	Rows       []TabularImportRow `json:"rows"`
	FileErrors []string           `json:"fileErrors"`
}

// fileProblem marks failures the user can fix by correcting the file. They are
// reported as HTTP 200 with a failed status so the console can show guidance,
// unlike malformed requests which stay HTTP errors.
type fileProblem struct{ msg string }

func (e *fileProblem) Error() string { return e.msg }

func fileProblemf(format string, args ...interface{}) error {
	return &fileProblem{msg: fmt.Sprintf(format, args...)}
}

// ParseTabularImport parses an uploaded CSV or Excel file into rows.
func ParseTabularImport(c echo.Context) error {
	req := new(TabularImportRequest)
	if err := c.Bind(req); err != nil {
		return response.BadRequest(c, "Invalid request body.")
	}
	if req.Content == "" && req.ContentBase64 == "" {
		return response.BadRequest(c, "File content is required.")
	}

	raw, err := decodeImportContent(req)
	if err != nil {
		return respondFileProblem(c, err)
	}

	result, err := parseTabular(req.FileName, raw)
	if err != nil {
		return respondFileProblem(c, err)
	}

	return response.Success(c, result)
}

// respondFileProblem returns HTTP 200 with a failed status for file problems so
// the console can tell the user what to fix. Anything else is a real server
// error and must not be dressed up as success.
func respondFileProblem(c echo.Context, err error) error {
	var fp *fileProblem
	if errors.As(err, &fp) {
		return c.JSON(http.StatusOK, &response.CommonResponse{
			ResponseData: nil,
			Status: response.WebStatus{
				StatusCode: http.StatusUnprocessableEntity,
				Message:    fp.Error(),
			},
		})
	}
	return response.InternalServerError(c, "Failed to parse the file.")
}

func decodeImportContent(req *TabularImportRequest) ([]byte, error) {
	if req.ContentBase64 != "" {
		raw, err := base64.StdEncoding.DecodeString(req.ContentBase64)
		if err != nil {
			return nil, fileProblemf("The file could not be read. It may be corrupted.")
		}
		if len(raw) > maxImportFileBytes {
			return nil, fileProblemf("The file is too large. (limit: %d MB)", maxImportFileBytes>>20)
		}
		return raw, nil
	}

	if len(req.Content) > maxImportFileBytes {
		return nil, fileProblemf("The file is too large. (limit: %d MB)", maxImportFileBytes>>20)
	}
	return []byte(req.Content), nil
}

func parseTabular(fileName string, raw []byte) (*TabularImportResult, error) {
	switch detectFormat(fileName, raw) {
	case "xlsx":
		return parseExcel(raw)
	case "xls":
		// The legacy binary format is a different container that excelize does
		// not read. Tell the user how to convert rather than failing vaguely.
		return nil, fileProblemf("The legacy .xls format is not supported. Save the file as .xlsx and try again.")
	default:
		return parseCSV(raw)
	}
}

func detectFormat(fileName string, raw []byte) string {
	lower := strings.ToLower(fileName)
	switch {
	case strings.HasSuffix(lower, ".xlsx"), strings.HasSuffix(lower, ".xlsm"):
		return "xlsx"
	case strings.HasSuffix(lower, ".xls"):
		return "xls"
	case strings.HasSuffix(lower, ".csv"):
		return "csv"
	}

	// Fall back to content sniffing when the name is missing or unusual.
	// xlsx is a zip archive; the legacy .xls container has its own signature.
	if bytes.HasPrefix(raw, []byte{0x50, 0x4B, 0x03, 0x04}) {
		return "xlsx"
	}
	if bytes.HasPrefix(raw, []byte{0xD0, 0xCF, 0x11, 0xE0}) {
		return "xls"
	}
	return "csv"
}

func parseCSV(raw []byte) (*TabularImportResult, error) {
	// encoding/csv handles quoted fields containing commas and embedded
	// newlines, which the previous line-splitting approach silently corrupted.
	reader := csv.NewReader(bytes.NewReader(stripBOM(raw)))
	reader.FieldsPerRecord = -1 // report ragged rows ourselves, with row numbers
	reader.LazyQuotes = false
	reader.TrimLeadingSpace = true

	records, err := reader.ReadAll()
	if err != nil {
		return nil, fileProblemf("The file could not be read as CSV. %s", csvHint(err))
	}
	return buildResult("csv", records)
}

func parseExcel(raw []byte) (*TabularImportResult, error) {
	f, err := excelize.OpenReader(bytes.NewReader(raw))
	if err != nil {
		return nil, excelOpenProblem(err)
	}
	defer func() { _ = f.Close() }()

	sheets := f.GetSheetList()
	if len(sheets) == 0 {
		return nil, fileProblemf("The workbook has no sheets.")
	}

	records, err := f.GetRows(sheets[0])
	if err != nil {
		return nil, fileProblemf("The first sheet could not be read.")
	}
	return buildResult("xlsx", records)
}

// excelOpenProblem turns library errors into guidance the user can act on.
func excelOpenProblem(err error) error {
	msg := strings.ToLower(err.Error())
	switch {
	case strings.Contains(msg, "password") || strings.Contains(msg, "encrypt"):
		return fileProblemf("The file is password protected and cannot be read. Remove the password and try again.")
	case strings.Contains(msg, "not a zip") || strings.Contains(msg, "zip"):
		return fileProblemf("The file is not a valid .xlsx workbook. If it was saved in an older Excel format, save it as .xlsx and try again.")
	default:
		return fileProblemf("The workbook could not be opened. It may be corrupted or saved in an unsupported format.")
	}
}

func csvHint(err error) string {
	if errors.Is(err, csv.ErrQuote) || strings.Contains(err.Error(), "quote") {
		return "A quoted value is not closed properly."
	}
	return "Check that the file is valid CSV."
}

// buildResult maps the header row onto each data row. Rows keep their original
// position so the console can point at the offending line.
func buildResult(format string, records [][]string) (*TabularImportResult, error) {
	nonEmpty := make([][]string, 0, len(records))
	for _, rec := range records {
		if !isBlankRecord(rec) {
			nonEmpty = append(nonEmpty, rec)
		}
	}
	if len(nonEmpty) == 0 {
		return nil, fileProblemf("The file is empty.")
	}

	headers := make([]string, 0, len(nonEmpty[0]))
	for _, h := range nonEmpty[0] {
		headers = append(headers, strings.TrimSpace(h))
	}
	if len(headers) > maxImportColumns {
		return nil, fileProblemf("The file has too many columns. (limit: %d)", maxImportColumns)
	}

	dataRows := nonEmpty[1:]
	if len(dataRows) == 0 {
		return nil, fileProblemf("The file has a header row but no data rows.")
	}
	if len(dataRows) > maxImportRows {
		return nil, fileProblemf("The file has too many rows. (limit: %d)", maxImportRows)
	}

	result := &TabularImportResult{
		Format:     format,
		Headers:    headers,
		Rows:       make([]TabularImportRow, 0, len(dataRows)),
		FileErrors: []string{},
	}

	for i, rec := range dataRows {
		if len(rec) > len(headers) {
			result.FileErrors = append(result.FileErrors,
				fmt.Sprintf("Row %d has more values than there are columns.", i+1))
		}
		data := make(map[string]string, len(headers))
		for idx, header := range headers {
			if header == "" {
				continue
			}
			value := ""
			if idx < len(rec) {
				value = strings.TrimSpace(rec[idx])
			}
			data[header] = value
		}
		result.Rows = append(result.Rows, TabularImportRow{Index: i + 1, Data: data})
	}

	return result, nil
}

func isBlankRecord(rec []string) bool {
	for _, v := range rec {
		if strings.TrimSpace(v) != "" {
			return false
		}
	}
	return true
}

// stripBOM removes the UTF-8 byte order mark. Excel writes one, and our own
// template includes it, so leaving it in place corrupts the first header name.
func stripBOM(raw []byte) []byte {
	return bytes.TrimPrefix(raw, []byte{0xEF, 0xBB, 0xBF})
}
