package handler

import (
	"net/http"
	"strings"

	"api/internal/util/response"

	"github.com/labstack/echo/v4"
)

// LookupDiskInfo represents disk information for lookup
type LookupDiskInfo struct {
	ProviderID   string   `json:"providerId"`
	RootDiskType []string `json:"rootdisktype"`
	DataDiskType []string `json:"datadisktype"`
	DiskSize     []string `json:"disksize"`
}

// AvailableDiskType represents available disk types
type AvailableDiskType struct {
	ProviderID   string   `json:"providerId"`
	RootDiskType []string `json:"rootdisktype"`
	DataDiskType []string `json:"datadisktype"`
	DiskSize     []string `json:"disksize"`
}

// DiskHandler handles disk-related endpoints
type DiskHandler struct{}

// NewDiskHandler creates a new DiskHandler
func NewDiskHandler() *DiskHandler {
	return &DiskHandler{}
}

// DiskLookup handles disk information lookup
func (h *DiskHandler) DiskLookup(c echo.Context) error {
	commonRequest := &CommonRequest{}
	if err := c.Bind(commonRequest); err != nil {
		return c.JSON(http.StatusBadRequest, response.CommonResponseStatusBadRequest(err.Error()))
	}

	providerId := strings.ToUpper(commonRequest.QueryParams["provider"])
	connectionName := commonRequest.QueryParams["connectionName"]

	diskInfoMap := getDiskInfoMap()

	dataDiskInfoList := []LookupDiskInfo{}
	if providerId != "" {
		if connectionName != "" {
			// TODO: filter by connection
		}
		providerDisk := diskInfoMap[providerId]
		dataDiskInfoList = append(dataDiskInfoList, providerDisk)
	}

	return c.JSON(http.StatusOK, response.CommonResponseStatusOK(dataDiskInfoList))
}

// AvailableDiskTypeByProviderRegion handles available disk type lookup
func (h *DiskHandler) AvailableDiskTypeByProviderRegion(c echo.Context) error {
	commonRequest := &CommonRequest{}
	if err := c.Bind(commonRequest); err != nil {
		return c.JSON(http.StatusBadRequest, response.CommonResponseStatusBadRequest(err.Error()))
	}

	providerId := strings.ToUpper(commonRequest.QueryParams["provider"])
	regionName := commonRequest.QueryParams["regionName"]

	diskInfoMap := getAvailableDiskInfoMap()

	dataDiskInfoList := []AvailableDiskType{}
	if providerId != "" {
		if regionName != "" {
			// TODO: filter by region if needed
		}
		providerDisk := diskInfoMap[strings.ToUpper(providerId)]
		dataDiskInfoList = append(dataDiskInfoList, providerDisk)
	}

	return c.JSON(http.StatusOK, response.CommonResponseStatusOK(dataDiskInfoList))
}

func getDiskInfoMap() map[string]LookupDiskInfo {
	diskInfoMap := map[string]LookupDiskInfo{}

	// AWS
	awsRootdiskType := "standard / gp2 / gp3"
	awsDiskType := "standard / gp2 / gp3 / io1 / io2 / st1 / sc1"
	awsDiskSize := "standard|1|1024|GB / gp2|1|16384|GB / gp3|1|16384|GB / io1|4|16384|GB / io2|4|16384|GB / st1|125|16384|GB / sc1|125|16384|GB"

	awsDiskInfo := LookupDiskInfo{}
	awsDiskInfo.ProviderID = "AWS"
	awsDiskInfo.RootDiskType = strings.Split(strings.ReplaceAll(awsRootdiskType, " ", ""), "/")
	awsDiskInfo.DataDiskType = strings.Split(strings.ReplaceAll(awsDiskType, " ", ""), "/")
	awsDiskInfo.DiskSize = strings.Split(strings.ReplaceAll(awsDiskSize, " ", ""), "/")
	diskInfoMap["AWS"] = awsDiskInfo

	// GCP
	gcpRootdiskType := "pd-standard / pd-balanced / pd-ssd / pd-extreme"
	gcpDiskType := "pd-standard / pd-balanced / pd-ssd / pd-extreme"
	gcpDiskSize := "pd-standard|10|65536|GB / pd-balanced|10|65536|GB / pd-ssd|10|65536|GB / pd-extreme|500|65536|GB"

	gcpDiskInfo := LookupDiskInfo{}
	gcpDiskInfo.ProviderID = "GCP"
	gcpDiskInfo.RootDiskType = strings.Split(strings.ReplaceAll(gcpRootdiskType, " ", ""), "/")
	gcpDiskInfo.DataDiskType = strings.Split(strings.ReplaceAll(gcpDiskType, " ", ""), "/")
	gcpDiskInfo.DiskSize = strings.Split(strings.ReplaceAll(gcpDiskSize, " ", ""), "/")
	diskInfoMap["GCP"] = gcpDiskInfo

	// ALIBABA
	aliRootdiskType := "cloud_essd / cloud_efficiency / cloud / cloud_ssd"
	aliDiskType := "cloud / cloud_efficiency / cloud_ssd / cloud_essd"
	aliDiskSize := "cloud|5|2000|GB / cloud_efficiency|20|32768|GB / cloud_ssd|20|32768|GB / cloud_essd_PL0|40|32768|GB / cloud_essd_PL1|20|32768|GB / cloud_essd_PL2|461|32768|GB / cloud_essd_PL3|1261|32768|GB"

	aliDiskInfo := LookupDiskInfo{}
	aliDiskInfo.ProviderID = "ALIBABA"
	aliDiskInfo.RootDiskType = strings.Split(strings.ReplaceAll(aliRootdiskType, " ", ""), "/")
	aliDiskInfo.DataDiskType = strings.Split(strings.ReplaceAll(aliDiskType, " ", ""), "/")
	aliDiskInfo.DiskSize = strings.Split(strings.ReplaceAll(aliDiskSize, " ", ""), "/")
	diskInfoMap["ALIBABA"] = aliDiskInfo

	// TENCENT
	tencentRootdiskType := "CLOUD_PREMIUM / CLOUD_SSD"
	tencentDiskType := "CLOUD_PREMIUM / CLOUD_SSD / CLOUD_HSSD / CLOUD_BASIC / CLOUD_TSSD"
	tencentDiskSize := "CLOUD_PREMIUM|10|32000|GB / CLOUD_SSD|20|32000|GB / CLOUD_HSSD|20|32000|GB / CLOUD_BASIC|10|32000|GB / CLOUD_TSSD|10|32000|GB"

	tencentDiskInfo := LookupDiskInfo{}
	tencentDiskInfo.ProviderID = "TENCENT"
	tencentDiskInfo.RootDiskType = strings.Split(strings.ReplaceAll(tencentRootdiskType, " ", ""), "/")
	tencentDiskInfo.DataDiskType = strings.Split(strings.ReplaceAll(tencentDiskType, " ", ""), "/")
	tencentDiskInfo.DiskSize = strings.Split(strings.ReplaceAll(tencentDiskSize, " ", ""), "/")
	diskInfoMap["TENCENT"] = tencentDiskInfo

	return diskInfoMap
}

func getAvailableDiskInfoMap() map[string]AvailableDiskType {
	diskInfoMap := map[string]AvailableDiskType{}

	// AWS
	awsRootdiskType := "standard / gp2 / gp3"
	awsDiskType := "standard / gp2 / gp3 / io1 / io2 / st1 / sc1"
	awsDiskSize := "standard|1|1024|GB / gp2|1|16384|GB / gp3|1|16384|GB / io1|4|16384|GB / io2|4|16384|GB / st1|125|16384|GB / sc1|125|16384|GB"

	awsDiskInfo := AvailableDiskType{}
	awsDiskInfo.ProviderID = "AWS"
	awsDiskInfo.RootDiskType = strings.Split(strings.ReplaceAll(awsRootdiskType, " ", ""), "/")
	awsDiskInfo.DataDiskType = strings.Split(strings.ReplaceAll(awsDiskType, " ", ""), "/")
	awsDiskInfo.DiskSize = strings.Split(strings.ReplaceAll(awsDiskSize, " ", ""), "/")
	diskInfoMap["AWS"] = awsDiskInfo

	// GCP
	gcpRootdiskType := "pd-standard / pd-balanced / pd-ssd / pd-extreme"
	gcpDiskType := "pd-standard / pd-balanced / pd-ssd / pd-extreme"
	gcpDiskSize := "pd-standard|10|65536|GB / pd-balanced|10|65536|GB / pd-ssd|10|65536|GB / pd-extreme|500|65536|GB"

	gcpDiskInfo := AvailableDiskType{}
	gcpDiskInfo.ProviderID = "GCP"
	gcpDiskInfo.RootDiskType = strings.Split(strings.ReplaceAll(gcpRootdiskType, " ", ""), "/")
	gcpDiskInfo.DataDiskType = strings.Split(strings.ReplaceAll(gcpDiskType, " ", ""), "/")
	gcpDiskInfo.DiskSize = strings.Split(strings.ReplaceAll(gcpDiskSize, " ", ""), "/")
	diskInfoMap["GCP"] = gcpDiskInfo

	// ALIBABA
	aliRootdiskType := "cloud_essd / cloud_efficiency / cloud / cloud_ssd"
	aliDiskType := "cloud / cloud_efficiency / cloud_ssd / cloud_essd"
	aliDiskSize := "cloud|5|2000|GB / cloud_efficiency|20|32768|GB / cloud_ssd|20|32768|GB / cloud_essd_PL0|40|32768|GB / cloud_essd_PL1|20|32768|GB / cloud_essd_PL2|461|32768|GB / cloud_essd_PL3|1261|32768|GB"

	aliDiskInfo := AvailableDiskType{}
	aliDiskInfo.ProviderID = "ALIBABA"
	aliDiskInfo.RootDiskType = strings.Split(strings.ReplaceAll(aliRootdiskType, " ", ""), "/")
	aliDiskInfo.DataDiskType = strings.Split(strings.ReplaceAll(aliDiskType, " ", ""), "/")
	aliDiskInfo.DiskSize = strings.Split(strings.ReplaceAll(aliDiskSize, " ", ""), "/")
	diskInfoMap["ALIBABA"] = aliDiskInfo

	// TENCENT
	tencentRootdiskType := "CLOUD_PREMIUM / CLOUD_SSD"
	tencentDiskType := "CLOUD_PREMIUM / CLOUD_SSD / CLOUD_HSSD / CLOUD_BASIC / CLOUD_TSSD"
	tencentDiskSize := "CLOUD_PREMIUM|10|32000|GB / CLOUD_SSD|20|32000|GB / CLOUD_HSSD|20|32000|GB / CLOUD_BASIC|10|32000|GB / CLOUD_TSSD|10|32000|GB"

	tencentDiskInfo := AvailableDiskType{}
	tencentDiskInfo.ProviderID = "TENCENT"
	tencentDiskInfo.RootDiskType = strings.Split(strings.ReplaceAll(tencentRootdiskType, " ", ""), "/")
	tencentDiskInfo.DataDiskType = strings.Split(strings.ReplaceAll(tencentDiskType, " ", ""), "/")
	tencentDiskInfo.DiskSize = strings.Split(strings.ReplaceAll(tencentDiskSize, " ", ""), "/")
	diskInfoMap["TENCENT"] = tencentDiskInfo

	return diskInfoMap
}
