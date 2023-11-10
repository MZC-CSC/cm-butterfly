package mcir

import (
	tbcommon "cm_butterfly/frameworkmodel/tumblebug/common"
)

type SpiderSubnetInfo struct {
	IID          tbcommon.TbIID        `json:"iid"`
	Ipv4_CIDR    string                `json:"ipv4_CIDR"`
	KeyValueList []tbcommon.TbKeyValue `json:"keyValueList"`
}

type SpiderSubnetInfos []SpiderSubnetInfo
