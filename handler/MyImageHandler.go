package handler

import (
	"encoding/json"
	"fmt"
	"log"

	// "math"
	"net/http"
	// "strconv"
	// "sync"

	//"github.com/davecgh/go-spew/spew"

	// "cm_butterfly/frameworkmodel/spider"
	// "cm_butterfly/frameworkmodel/tumblebug"
	tbcommon "cm_butterfly/frameworkmodel/tumblebug/common"
	tbmcir "cm_butterfly/frameworkmodel/tumblebug/mcir"

	fwmodel "cm_butterfly/frameworkmodel"
	util "cm_butterfly/util"
)

// MyImage 목록 조회
func GetMyImageList(nameSpaceID string, optionParam string, filterKeyParam string, filterValParam string) ([]tbmcir.TbCustomImageInfo, fwmodel.WebStatus) {
	var originalUrl = "/ns/{nsId}/resources/customImage"
	var paramMapper = make(map[string]string)
	paramMapper["{nsId}"] = nameSpaceID
	urlParam := util.MappingUrlParameter(originalUrl, paramMapper)

	if optionParam != "" {
		urlParam += "?option=" + optionParam
	} else {
		urlParam += "?option="
	}
	if filterKeyParam != "" {
		urlParam += "&filterKey=" + filterKeyParam
		urlParam += "&filterVal=" + filterValParam
	}

	url := util.TUMBLEBUG + urlParam

	resp, err := util.CommonHttp(url, nil, http.MethodGet)

	if err != nil {
		fmt.Println(err)
		return nil, fwmodel.WebStatus{StatusCode: 500, Message: err.Error()}
	}
	// defer body.Close()
	respBody := resp.Body
	respStatus := resp.StatusCode

	// return respBody, respStatus
	log.Println(respBody)
	myImageInfoList := map[string][]tbmcir.TbCustomImageInfo{}
	json.NewDecoder(respBody).Decode(&myImageInfoList)
	//spew.Dump(body)
	fmt.Println(myImageInfoList["customImage"])

	return myImageInfoList["customImage"], fwmodel.WebStatus{StatusCode: respStatus}
}

func GetMyImageListByID(nameSpaceID string, filterKeyParam string, filterValParam string) ([]string, fwmodel.WebStatus) {
	fmt.Println("GetMyImageListByID ************ : ")
	var originalUrl = "/ns/{nsId}/resources/customImage"
	var paramMapper = make(map[string]string)
	paramMapper["{nsId}"] = nameSpaceID
	urlParam := util.MappingUrlParameter(originalUrl, paramMapper)

	urlParam += "?option=id"
	if filterKeyParam != "" {
		urlParam += "&filterKey=" + filterKeyParam
		urlParam += "&filterVal=" + filterValParam
	}
	url := util.TUMBLEBUG + urlParam
	resp, err := util.CommonHttp(url, nil, http.MethodGet)

	if err != nil {
		fmt.Println(err)
		return nil, fwmodel.WebStatus{StatusCode: 500, Message: err.Error()}
	}
	// defer body.Close()
	respBody := resp.Body
	respStatus := resp.StatusCode

	// return respBody, respStatus
	log.Println(respBody)
	//vNetInfoList := map[string][]string{}
	myImageInfoList := tbcommon.TbIdList{}
	json.NewDecoder(respBody).Decode(&myImageInfoList)

	return myImageInfoList.IDList, fwmodel.WebStatus{StatusCode: respStatus}
}

// List 조회시 optionParam 추가
func GetMyImageListByOption(nameSpaceID string, optionParam string, filterKeyParam string, filterValParam string) ([]tbmcir.TbCustomImageInfo, fwmodel.WebStatus) {
	fmt.Println("GetMyImageListByOption ************ : ")
	var originalUrl = "/ns/{nsId}/resources/customImage"
	var paramMapper = make(map[string]string)
	paramMapper["{nsId}"] = nameSpaceID
	urlParam := util.MappingUrlParameter(originalUrl, paramMapper)

	if optionParam != "" {
		urlParam += "?option=" + optionParam
	} else {
		urlParam += "?option="
	}
	if filterKeyParam != "" {
		urlParam += "&filterKey=" + filterKeyParam
		urlParam += "&filterVal=" + filterValParam
	}
	url := util.TUMBLEBUG + urlParam

	resp, err := util.CommonHttp(url, nil, http.MethodGet)

	if err != nil {
		fmt.Println(err)
		return nil, fwmodel.WebStatus{StatusCode: 500, Message: err.Error()}
	}
	// defer body.Close()
	respBody := resp.Body
	respStatus := resp.StatusCode

	// return respBody, respStatus
	log.Println(respBody)
	myImageInfoList := map[string][]tbmcir.TbCustomImageInfo{}
	json.NewDecoder(respBody).Decode(&myImageInfoList)
	//spew.Dump(body)
	fmt.Println(myImageInfoList["customImage"])

	return myImageInfoList["customImage"], fwmodel.WebStatus{StatusCode: respStatus}
}

// CSP에 등록 된 customImage를 TB의 customImage로 등록
func RegCspCustomImageToMyImage(nameSpaceID string, myImageReqInfo *tbmcir.TbCustomImageReq) (*tbmcir.TbCustomImageInfo, fwmodel.WebStatus) {
	var originalUrl = "/ns/{nsId}/resources/myImage"
	var paramMapper = make(map[string]string)
	paramMapper["{nsId}"] = nameSpaceID
	urlParam := util.MappingUrlParameter(originalUrl, paramMapper)

	url := util.TUMBLEBUG + urlParam

	fmt.Println("myImageReqInfo : ", myImageReqInfo)

	pbytes, _ := json.Marshal(myImageReqInfo)
	fmt.Println(string(pbytes))
	resp, err := util.CommonHttp(url, pbytes, http.MethodPost)
	resultMyImageInfo := tbmcir.TbCustomImageInfo{}
	if err != nil {
		fmt.Println(err)
		return &resultMyImageInfo, fwmodel.WebStatus{StatusCode: 500, Message: err.Error()}
	}

	respBody := resp.Body
	respStatus := resp.StatusCode
	fmt.Println("respStatus ", respStatus)

	if respStatus == 500 {
		webStatus := fwmodel.WebStatus{}
		json.NewDecoder(respBody).Decode(&webStatus)
		fmt.Println(webStatus)
		webStatus.StatusCode = respStatus
		return &resultMyImageInfo, webStatus
	}
	// 응답에 생성한 객체값이 옴
	json.NewDecoder(respBody).Decode(&resultMyImageInfo)
	fmt.Println(resultMyImageInfo)

	return &resultMyImageInfo, fwmodel.WebStatus{StatusCode: respStatus}
}

// Namespace내 모든 MyImage 삭제
func DelAllMyImage(nameSpaceID string) (fwmodel.WebStatus, fwmodel.WebStatus) {
	webStatus := fwmodel.WebStatus{}

	var originalUrl = "/ns/{nsId}/resources/myImage"
	var paramMapper = make(map[string]string)
	paramMapper["{nsId}"] = nameSpaceID
	urlParam := util.MappingUrlParameter(originalUrl, paramMapper)
	url := util.TUMBLEBUG + urlParam + "?match=match"

	resp, err := util.CommonHttp(url, nil, http.MethodDelete)

	if err != nil {
		fmt.Println(err)
		return webStatus, fwmodel.WebStatus{StatusCode: 500, Message: err.Error()}
	}
	// return body, err
	respBody := resp.Body
	respStatus := resp.StatusCode
	resultInfo := fwmodel.ResultInfo{}

	json.NewDecoder(respBody).Decode(&resultInfo)
	log.Println(resultInfo)
	log.Println("ResultMessage : " + resultInfo.Message)

	if respStatus != 200 && respStatus != 201 {
		return fwmodel.WebStatus{}, fwmodel.WebStatus{StatusCode: respStatus, Message: resultInfo.Message}
	}
	webStatus.StatusCode = respStatus
	webStatus.Message = resultInfo.Message
	return webStatus, fwmodel.WebStatus{StatusCode: respStatus}
}

// MyImage 삭제
func DelMyImage(nameSpaceID string, myImageID string) (fwmodel.WebStatus, fwmodel.WebStatus) {
	webStatus := fwmodel.WebStatus{}

	var originalUrl = "/ns/{nsId}/resources/customImage/{myImageId}"
	var paramMapper = make(map[string]string)
	paramMapper["{nsId}"] = nameSpaceID
	paramMapper["{myImageId}"] = myImageID
	urlParam := util.MappingUrlParameter(originalUrl, paramMapper)
	url := util.TUMBLEBUG + urlParam

	resp, err := util.CommonHttp(url, nil, http.MethodDelete)

	if err != nil {
		fmt.Println(err)
		return webStatus, fwmodel.WebStatus{StatusCode: 500, Message: err.Error()}
	}
	// return body, err
	respBody := resp.Body
	respStatus := resp.StatusCode
	resultInfo := fwmodel.ResultInfo{}

	json.NewDecoder(respBody).Decode(&resultInfo)
	log.Println(resultInfo)
	log.Println("ResultMessage : " + resultInfo.Message)

	if respStatus != 200 && respStatus != 201 {
		return fwmodel.WebStatus{}, fwmodel.WebStatus{StatusCode: respStatus, Message: resultInfo.Message}
	}
	webStatus.StatusCode = respStatus
	webStatus.Message = resultInfo.Message
	return webStatus, fwmodel.WebStatus{StatusCode: respStatus}
}

// MyImage 상세 조회
func MyImageGet(nameSpaceID string, myImageID string) (*tbmcir.TbCustomImageInfo, fwmodel.WebStatus) {
	var originalUrl = "/ns/{nsId}/resources/customImage/{myImageId}"
	var paramMapper = make(map[string]string)
	paramMapper["{nsId}"] = nameSpaceID
	paramMapper["{myImageId}"] = myImageID
	urlParam := util.MappingUrlParameter(originalUrl, paramMapper)
	url := util.TUMBLEBUG + urlParam

	fmt.Println("nameSpaceID : ", nameSpaceID)

	resp, err := util.CommonHttp(url, nil, http.MethodGet)
	myImageInfo := tbmcir.TbCustomImageInfo{}
	if err != nil {
		fmt.Println(err)
		return &myImageInfo, fwmodel.WebStatus{StatusCode: 500, Message: err.Error()}
	}

	respBody := resp.Body
	respStatus := resp.StatusCode

	json.NewDecoder(respBody).Decode(&myImageInfo)
	fmt.Println(myImageInfo)

	return &myImageInfo, fwmodel.WebStatus{StatusCode: respStatus}
}
