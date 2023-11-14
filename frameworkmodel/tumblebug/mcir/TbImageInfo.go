package mcir

import (
	tbcommon "cm_butterfly/frameworkmodel/tumblebug/common"
)

type TbImageInfo struct {
	AssociatedObjectList []string `json:"associatedObjectList"`

	ConnectionName  string `json:"connectionName"`
	CreationDate    string `json:"creationDate"`
	CspImageId      string `json:"cspImageId"`
	CspImageName    string `json:"cspImageName"`
	Description     string `json:"description"`
	GuestOS         string `json:"guestOS"`
	ID              string `json:"id"`
	IsAutoGenerated string `json:"isAutoGenerated"`

	KeyValueList []tbcommon.TbKeyValue `json:"keyValueList"`
	Name         string                `json:"name"`
	Namespace    string                `json:"namespace"` //required
	Status       string                `json:"status"`
	SystemLabel  string                `json:"systemLabel"`

	// connection 을 provider, regname으로 대체를 위해 추가
	ProviderID   string `json:"providerId"`
	ProviderName string `json:"providerName"`
	RegionName   string `json:"regionName"`
	ZoneName     string `json:"zoneName"`
}

type TbImageInfos []TbImageInfo
