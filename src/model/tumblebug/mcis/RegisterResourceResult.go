package mcis

import (
	tbcommon "github.com/cloud-barista/cm-butterfly/src/model/tumblebug/common"
)

type RegisterResourceResult struct {
	ConnectionName        string                `json:"connectionName"`
	ElapsedTime           int                   `json:"elapsedTime"`
	RegisterationOutputs  tbcommon.TbIdList     `json:"registerationOutputs"`
	RegisterationOverview RegisterationOverview `json:"registerationOverview"`
	SystemMessage         string                `json:"systemMessage"`
}