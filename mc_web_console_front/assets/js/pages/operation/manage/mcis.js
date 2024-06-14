import { TabulatorFull as Tabulator } from "tabulator-tables";

////
// 모달 콜백 예제
export function commoncallbac(val) {
  alert(val);
}
////

////////// TABULATOR //////////
var table;
var checked_array = [];
initTable();
function setTabulator(
  tableObjId,
  tableObjParamMap,
  columnsParams,
  isMultiSelect
) {
  var placeholder = "No Data";
  var pagination = "local";
  var paginationSize = 5;
  var paginationSizeSelector = [5, 10, 15, 20];
  var movableColumns = true;
  var columnHeaderVertAlign = "middle";
  var paginationCounter = "rows";
  var layout = "fitColumns";

  if (tableObjParamMap.hasOwnProperty("placeholder")) {
    placeholder = tableObjParamMap.placeholder;
  }

  if (tableObjParamMap.hasOwnProperty("pagination")) {
    pagination = tableObjParamMap.pagination;
  }

  if (tableObjParamMap.hasOwnProperty("paginationSize")) {
    paginationSize = tableObjParamMap.paginationSize;
  }

  if (tableObjParamMap.hasOwnProperty("paginationSizeSelector")) {
    paginationSizeSelector = tableObjParamMap.paginationSizeSelector;
  }

  if (tableObjParamMap.hasOwnProperty("movableColumns")) {
    movableColumns = tableObjParamMap.movableColumns;
  }

  if (tableObjParamMap.hasOwnProperty("columnHeaderVertAlign")) {
    columnHeaderVertAlign = tableObjParamMap.columnHeaderVertAlign;
  }

  if (tableObjParamMap.hasOwnProperty("paginationCounter")) {
    paginationCounter = tableObjParamMap.paginationCounter;
  }

  if (tableObjParamMap.hasOwnProperty("layout")) {
    layout = tableObjParamMap.layout;
  }

  var tabulatorTable = new Tabulator("#" + tableObjId, {
    //ajaxURL:"http://localhost:3000/operations/mcismng?option=status",
    placeholder,
    pagination,
    paginationSize,
    paginationSizeSelector,
    movableColumns,
    columnHeaderVertAlign,
    paginationCounter,
    layout,
    columns: columnsParams,
    selectableRows: isMultiSelect == false ? 1 : true,
  });

  return tabulatorTable;
}

// Table 초기값 설정
function initTable() {

  var tableObjParams = {};

  var columns = [
    {
      formatter: "rowSelection",
      titleFormatter: "rowSelection",
      vertAlign: "middle",
      hozAlign: "center",
      headerHozAlign: "center",
      headerSort: false,
      width: 60,
    },
    {
      title: "Status",
      field: "status",
      formatter: statusFormatter,
      vertAlign: "middle",
      hozAlign: "center",
      headerHozAlign: "center",
      headerSort: false,
      maxWidth: 100,
    },
    {
      title: "Id",
      field: "id",
      visible: false
    },
    {
      title: "System Label",
      field: "systemLabel",
      visible: false
    },
    {
      title: "Name",
      field: "name",
      vertAlign: "middle"
    },
    {
      title: "ProviderImg",
      field: "providerImg",
      formatter: providerFormatter,
      vertAlign: "middle",
      hozAlign: "center",
      headerSort: false,
    },
    {
      title: "Provider",
      field: "provider",
      formatter: providerFormatterString,
      visible: false
    },
    {
      title: "Total Servers",
      field: "statusCount.countTotal",
      vertAlign: "middle",
      hozAlign: "center",
      maxWidth: 150,
    },
    {
      title: "Running",
      field: "statusCount.countRunning",
      formatterParams: { status: "running" },
      vertAlign: "middle",
      hozAlign: "center",
      headerHozAlign: "center",
      maxWidth: 135,
    },
    {
      title: "Suspended",
      field: "statusCount.countSuspended",
      formatterParams: { status: "stop" },
      vertAlign: "middle",
      hozAlign: "center",
      headerHozAlign: "center",
      maxWidth: 135,
    },
    {
      title: "Terminated",
      field: "statusCount.countTerminated",
      formatterParams: { status: "terminate" },
      vertAlign: "middle",
      hozAlign: "center",
      headerHozAlign: "center",
      maxWidth: 135,
    },
  ];

  table = setTabulator("mcislist-table", tableObjParams, columns);

  // 행 클릭 시
  table.on("rowClick", function (e, row) {

    var mcisID = row.getCell("id").getValue();
    console.log("mcisID", mcisID)
    // console.log("eeeee",e)
    //clickListOfMcis(row.getCell("id").getValue());

    getSelectedMcisDate(mcisID)

  });

  //  선택된 여러개 row에 대해 처리
  table.on("rowSelectionChanged", function (data, rows) {
    checked_array = data
    console.log("checked_array", checked_array)
    console.log("rowsrows", data)
    selectedMcisObj = data
    // console.log(providerFormatterString());
  });

  // displayColumn(table);

}

// 클릭한 mcis info 가져오기
async function getSelectedMcisDate(mcisID) {

  const data = {
    pathParams: {
      // nsId: nsid,
      nsId: "testns01",
      mcisId: mcisID
    }
  }

  var controller = "/api/" + "getmcis";
  const response = await webconsolejs["common/api/http"].commonAPIPost(
    controller,
    data
  );

  console.log("response", response)
  var mcisData = response.data.responseData;
  console.log("mcisdata", mcisData)

  // SET MCIS Info 
  setMcisInfoData(mcisData)

  // Toggle MCIS Info
  var div = document.getElementById("mcis_info");
  webconsolejs["partials/layout/navigatePages"].toggleElement(div)

}

// 클릭한 mcis info 세팅
function setMcisInfoData(mcisData) {
  // console.log("setMcisInfoData", mcisIndex)
  try {
    var mcisID = mcisData.id;
    var mcisName = mcisData.name;
    var mcisDescription = mcisData.description;
    var mcisStatus = mcisData.status;
    var mcisDispStatus = getMcisStatusDisp(mcisStatus);
    var mcisStatusIcon = getMcisStatusIcon(mcisDispStatus);
    var mcisProviderNames = getMCISInfoProviderNames(mcisData);//MCIS에 사용 된 provider
    var totalvmCount = mcisData.vm.length;//mcis의 vm개수

    console.log("totalvmCount", totalvmCount)

    $("#mcis_info_text").text(" [ " + mcisName + " ]")
    $("#mcis_server_info_status").empty();
    $("#mcis_server_info_status").text(" [ " + mcisName + " ]")
    $("#mcis_server_info_count").text(" Server(" + totalvmCount + ")")


    $("#mcis_info_status_img").attr("src", "/assets/images/common/" + mcisStatusIcon)
    $("#mcis_info_name").text(mcisName + " / " + mcisID)
    $("#mcis_info_description").text(mcisDescription)
    $("#mcis_info_status").text(mcisStatus)
    $("#mcis_info_cloud_connection").empty()
    $("#mcis_info_cloud_connection").append(mcisProviderNames)

  } catch (e) {
    console.error(e);
  }

  displayServerStatusList(mcisID, mcisData.vm)

}

// vm 상태별 icon으로 표시
function displayServerStatusList(mcisID, vmList) {
  console.log("displayServerStatusList")

  var mcisName = mcisID;
  var vmLi = "";
  vmList.sort();
  for (var vmIndex in vmList) {
    var aVm = vmList[vmIndex]

    var vmID = aVm.id;
    var vmName = aVm.name;
    var vmStatus = aVm.status;
    var vmDispStatus = getVmStatusDisp(vmStatus);
    var vmStatusClass = getVmStatusClass(vmDispStatus)

    vmLi += '<li id="server_status_icon_' + vmID + '" class="card ' + vmStatusClass + '" onclick="webconsolejs[\'pages/operation/manage/mcis\'].vmDetailInfo(\'' + mcisID + '\',\'' + mcisName + '\',\'' + vmID + '\')"><span class="text-dark-fg">' + vmName + '</span></li>';

  }// end of mcis loop
  // totalvmCount = vmCount

  // console.log(vmLi)
  $("#mcis_server_info_box").empty();
  $("#mcis_server_info_box").append(vmLi);
  //Manage MCIS Server List on/off

}

export async function vmDetailInfo(mcisID, mcisName, vmID) {
  // Toggle MCIS Info
  var div = document.getElementById("server_info");
  webconsolejs["partials/layout/navigatePages"].toggleElement(div)

  console.log("vmDetailInfo")
  console.log("mcisID : ", mcisID)
  console.log("mcisName : ", mcisName)
  console.log("vmID : ", vmID)

  // 기존 값들 초기화
  //clearServerInfo();

  var aMcis = new Object();
  for (var mcisIndex in totalMcisListObj) {
    var tempMcis = totalMcisListObj[mcisIndex]
    if (mcisID == tempMcis.id) {
      aMcis = tempMcis;
      break;
    }
  }// end of mcis loop
  console.log("aMcis", aMcis);
  var vmList = aMcis.vm;
  var vmExist = false
  var data = new Object();
  for (var vmIndex in vmList) {
    var aVm = vmList[vmIndex]
    if (vmID == aVm.id) {
      //aVm = vmData;
      data = aVm;
      vmExist = true
      console.log("aVm", aVm)
      break;
    }
  }
  if (!vmExist) {
    console.log("vm is not exist");
    console.log(vmList)
  }
  console.log("selected Vm");
  console.log("selected vm data : ", data);
  var vmId = data.id;
  var vmName = data.name;
  var vmStatus = data.status;
  var vmDescription = data.description;
  var vmPublicIp = data.publicIP == undefined ? "" : data.publicIP;
  console.log("vmPublicIp", vmPublicIp)
  var vmSshKeyID = data.sshKeyId;
  var imageId = data.imageId
  var operatingSystem = await getCommonVmImageInfo(imageId)
  var startTime = data.cspViewVmDetail.StartTime
  var privateIp = data.privateIP
  var securityGroupID = data.securityGroupIds[0];
  var providerName = data.connectionConfig.providerName
  var vmProviderIcon = ""
  vmProviderIcon +=
    '<img class="img-fluid" class="rounded" width="80" src="/assets/images/common/img_logo_' +
    providerName +
    '.png" alt="' +
    providerName +
    '"/>';

  var vmDispStatus = getMcisStatusDisp(vmStatus);
  var mcisStatusIcon = getMcisStatusIcon(vmDispStatus);
  // var mcisProviderNames = getMCISInfoProviderNames(data);//MCIS에 사용 된 provider

  //vm info
  $("#mcis_server_info_status_img").attr("src", "/assets/images/common/" + mcisStatusIcon)
  $("#mcis_server_info_connection").empty()
  $("#mcis_server_info_connection").append(vmProviderIcon)


  $("#server_info_text").text(' [ ' + vmName + ' / ' + mcisName + ' ]')
  $("#server_info_name").text(vmName + "/" + vmID)
  $("#server_info_desc").text(vmDescription)
  $("#server_info_os").text(operatingSystem)
  $("#server_info_start_time").text(startTime)
  $("#server_info_private_ip").text(privateIp)
  $("#server_info_cspVMID").text(data.cspViewVmDetail.IId.NameId)

  // ip information
  $("#server_info_public_ip").text(vmPublicIp)
  $("#server_detail_info_public_ip_text").text("Public IP : " + vmPublicIp)
  $("#server_info_public_dns").text(data.publicDNS)
  // $("#server_info_private_ip").val(data.privateIP)
  $("#server_info_private_dns").text(data.privateDNS)

  $("#server_detail_view_public_ip").text(vmPublicIp)
  $("#server_detail_view_public_dns").text(data.publicDNS)
  $("#server_detail_view_private_ip").text(data.privateIP)
  $("#server_detail_view_private_dns").text(data.privateDNS)

  // detail tab
  $("#server_detail_info_text").text(' [' + vmName + '/' + mcisName + ']')
  $("#server_detail_view_server_id").text(vmId)
  $("#server_detail_view_server_status").text(vmStatus);
  $("#server_detail_view_public_dns").text(data.publicDNS)
  $("#server_detail_view_public_ip").text(vmPublicIp)
  $("#server_detail_view_private_ip").text(data.privateIP)
  $("#server_detail_view_security_group_text").text(securityGroupID)
  $("#server_detail_view_private_dns").text(data.privateDNS)
  $("#server_detail_view_private_ip").text(data.privateIP)
  $("#server_detail_view_image_id").text(imageId)
  $("#server_detail_view_os").text(operatingSystem);
  $("#server_detail_view_user_id_pass").text(data.vmUserAccount + "/ *** ")




  var region = data.region.Region

  var zone = data.region.Zone
  // $("#manage_mcis_popup_public_ip").val(vmPublicIp)

  // connection tab
  var connectionName = data.connectionName
  var credentialName = data.connectionConfig.credentialName
  var driverName = data.connectionConfig.driverName
  var locationInfo = data.location;
  var cloudType = locationInfo.cloudType;

  $("#server_connection_view_connection_name").text(connectionName)
  $("#server_connection_view_credential_name").text(credentialName)
  $("#server_connection_view_csp").text(providerName)
  $("#server_connection_view_driver_name").text(driverName)
  $("#server_connection_view_region").text(providerName + " : " + region)
  $("#server_connection_view_zone").text(zone)



  // $("#server_info_csp_icon").empty()
  // $("#server_info_csp_icon").append('<img src="/assets/img/contents/img_logo_' + cloudType + '.png" alt=""/>')
  // $("#server_connection_view_csp").val(cloudType)
  // $("#manage_mcis_popup_csp").val(cloudType)


  // var latitude = locationInfo.latitude;
  // var longitude = locationInfo.longitude;
  // var briefAddr = locationInfo.briefAddr;
  // var nativeRegion = locationInfo.nativeRegion;

  // if (locationInfo) {
  //     $("#server_location_latitude").val(latitude)
  //     $("#server_location_longitude").val(longitude)

  // }
  // region zone locate
  $("#server_info_region").text(providerName + ":" + region)
  $("#server_info_zone").text(zone)


  $("#server_detail_view_region").text(providerName + " : " + region)
  $("#server_detail_view_zone").text(zone)

  // connection name
  var connectionName = data.connectionName;
  $("#server_info_connection_name").text(connectionName)

  var vmDetail = data.cspViewVmDetail;
  var vmDetailKeyValueList = vmDetail.KeyValueList
  var architecture = "";

  if (vmDetailKeyValueList) {
    for (var i = 0; i < vmDetailKeyValueList.length; i++) {
      if (vmDetailKeyValueList[i].key === "Architecture") {
        architecture = vmDetailKeyValueList[i].value;
        break; // 찾았으므로 반복문을 종료
      }
    }
  }
  var vmSpecName = vmDetail.VMSpecName
  var vpcId = vmDetail.VpcIID.NameId
  var vpcSystemId = vmDetail.VpcIID.SystemId
  var subnetId = vmDetail.SubnetIID.NameId
  var subnetSystemId = vmDetail.SubnetIID.SystemId
  var eth = vmDetail.NetworkInterface



  $("#server_info_archi").text(architecture)
  // detail tab
  $("#server_detail_view_archi").text(architecture)
  $("#server_detail_view_vpc_id").text(vpcId + "(" + vpcSystemId + ")")
  $("#server_detail_view_subnet_id").text(subnetId + "(" + subnetSystemId + ")")
  $("#server_detail_view_eth").text(eth)
  $("#server_detail_view_root_device_type").text(vmDetail.RootDiskType);
  $("#server_detail_view_root_device").text(vmDetail.RootDeviceName);
  $("#server_detail_view_keypair_name").text(vmDetail.KeyPairIId.NameId)
  $("#server_detail_view_access_id_pass").text(vmDetail.VMUserId + "/ *** ")


  // server spec
  // var vmSecName = data.VmSpecName
  $("#server_info_vmspec_name").text(vmSpecName)
  $("#server_detail_view_server_spec").text(vmSpecName) // detail tab


}

async function getCommonVmImageInfo(imageId) {

  // endPoint := "/ns/{nsId}/resources/image/{imageId}"
  // common에 있는 이미지 사용
  // TODO: custom 일 때 처리
  // "/ns/system-purpose-common-ns/resources/image/{imageId}"

  const data = {
    pathParams: {
      // nsId: nsid, 
      imageId: imageId
    }
  }

  var controller = "/api/" + "getimageid";
  const response = await webconsolejs["common/api/http"].commonAPIPost(
    controller,
    data
  );

  var operatingSystem = response.data.responseData.guestOS
  console.log("OperatingSystem : ", operatingSystem)
  return operatingSystem
}


function clearServerInfo() {
  console.log("clearServerInfo")
  // $("#vm_id").val("");
  // $("#vm_name").val("");

  // $("#manage_mcis_popup_vm_id").val("")
  // $("#manage_mcis_popup_mcis_id").val("")
  // $("#manage_mcis_popup_sshkey_name").val("")

  $("#server_info_text").text("")
  $("#server_detail_info_text").text("")

  $("#server_detail_view_server_status").val("");

  // $("#server_info_status_icon_img").attr("src", "");

  $("#server_info_name").val("")
  $("#server_info_desc").val("")

  // ip information
  $("#server_info_public_ip").val("")
  $("#server_detail_info_public_ip_text").text("")
  $("#server_info_public_dns").val("")
  $("#server_info_private_ip").val("")
  $("#server_info_private_dns").val("")

  $("#server_detail_view_public_ip").val("")
  $("#server_detail_view_public_dns").val("")
  $("#server_detail_view_private_ip").val("")
  $("#server_detail_view_private_dns").val("")

  $("#manage_mcis_popup_public_ip").val("")

  // connection tab
  $("#server_info_csp_icon").empty()
  $("#server_connection_view_csp").val("")
  $("#manage_mcis_popup_csp").val("")

  $("#latitude").val("")
  $("#longitude").val("")

  $("#server_info_region").val("")
  $("#server_info_zone").val("")

  $("#server_detail_view_region").val("")
  $("#server_detail_view_zone").val("")

  $("#server_connection_view_region").val("")
  $("#server_connection_view_zone").val("")

  $("#server_info_connection_name").val("")
  $("#server_connection_view_connection_name").val("")

  $("#server_connection_view_credential_name").val("")
  $("#server_connection_view_driver_name").val("")

  $("#server_info_archi").val("")
  $("#server_detail_view_archi").val("")

  $("#server_info_vmspec_name").val("")
  $("#server_detail_view_server_spec").text("")

  $("#server_info_start_time").val("")

  $("#server_detail_view_server_id").val("")

  $("#server_detail_view_image_id").text("")

  $("#server_detail_view_vpc_id").text("")

  $("#server_detail_view_subnet_id").text("")
  $("#server_detail_view_eth").val("")

  // user account
  $("#server_detail_view_access_id_pass").val("")
  $("#server_detail_view_user_id_pass").val("")
  // $("#manage_mcis_popup_user_name").val("")

  $("#block_device_section").empty()
  // $("#attachedDiskList").empty()

  $("#server_detail_view_root_device_type").val("");
  $("#server_detail_view_root_device").val("");
  // $("#server_detail_disk_id").val("");
  // $("#server_detail_disk_mcis_id").val("");
  // $("#server_detail_disk_vm_id").val("");

  $("#server_detail_view_security_group").empty()
  $("#server_detail_view_keypair_name").val("")
  $("#server_info_cspVMID").val("")

  // $("#selected_mcis_id").val("");
  // $("#selected_vm_id").val("");

  // $("#exportFileName").val("");
  // $("#exportScript").val("");
}
// 상태별 이미지 추가
function getMcisStatusIcon(mcisDispStatus) {
  var mcisStatusIcon = "";
  if (mcisDispStatus == "running") {
    mcisStatusIcon = "icon_running.svg"
  } else if (mcisDispStatus == "include") {
    mcisStatusIcon = "icon_stop.svg"
  } else if (mcisDispStatus == "suspended") {
    mcisStatusIcon = "icon_stop.svg"
  } else if (mcisDispStatus == "terminate") {
    mcisStatusIcon = "icon_terminate.svg"
  } else {
    mcisStatusIcon = "icon_stop.svg"
  }
  return mcisStatusIcon
}

function getVmStatusIcon(vmDispStatus) {
  var vmStatusIcon = "";
  if (vmDispStatus == "running") {
    vmStatusIcon = "icon_running.svg"
  } else if (vmDispStatus == "stop") {
    vmStatusIcon = "icon_stop.svg"
  } else if (vmDispStatus == "suspended") {
    vmStatusIcon = "icon_stop.svg"
  } else if (vmDispStatus == "terminate") {
    vmStatusIcon = "icon_terminate.svg"
  } else {
    vmStatusIcon = "icon_stop.svg"
  }
  return vmStatusIcon;
}

// MCIS Info Set providerName
function getMCISInfoProviderNames(mcisData) {

  var mcisProviderNames = "";
  var vmCloudConnectionMap = webconsolejs["common/util"].calculateConnectionCount(
    mcisData.vm
  );
  console.log("vmCloudConnectionMap", vmCloudConnectionMap)
  if (vmCloudConnectionMap) {
    vmCloudConnectionMap.forEach((value, key) => {
      mcisProviderNames +=
        '<img class="img-fluid" class="rounded" width="30" src="/assets/images/common/img_logo_' +
        key +
        '.png" alt="' +
        key +
        '"/>';
    });
  }
  return mcisProviderNames
}

// function displayColumn(table) {
//   console.log("displayColumndisplayColumndisplayColumn")
//   $(".display-column").on("click", function () {
//     if ($(this).children("input:checkbox").is(":checked")) {
//       $(this).children(".material-icons").text("visibility");
//       table.showColumn($(this).data("column"));
//     } else {
//       $(this).children(".material-icons").text("visibility_off");
//       table.hideColumn($(this).data("column"));
//     }
//   });
// }

// 상태값을 table에서 표시하기 위해 감싸기
function statusFormatter(cell) {
  var mcisDispStatus = getMcisStatusDisp(
    cell.getData().status
  ); // 화면 표시용 status
  var mcisStatusCell =
    '<img title="' +
    cell.getData().status +
    '" src="/assets/images/common/icon_' +
    mcisDispStatus +
    '.svg" class="icon" alt="">';

  return mcisStatusCell;
}

// provider를 table에서 표시하기 위해 감싸기
function providerFormatter(data) {
  console.log("datadata", data)
  console.log("cell.getData().vm", data.getData().vm)
  var vmCloudConnectionMap = webconsolejs["common/util"].calculateConnectionCount(
    data.getData().vm
  );
  var mcisProviderCell = "";
  vmCloudConnectionMap.forEach((value, key) => {
    mcisProviderCell +=
      '<img class="img-fluid" class="rounded" width="30" src="/assets/images/common/img_logo_' +
      key +
      '.png" alt="' +
      key +
      '"/>';
  });

  return mcisProviderCell;
}

function providerFormatterString(data) {

  var vmCloudConnectionMap = webconsolejs["common/util"].calculateConnectionCount(
    data.getData().vm
  );

  var mcisProviderCell = "";
  vmCloudConnectionMap.forEach((value, key) => {
    mcisProviderCell += key + ", "
  });

  // Remove the trailing comma and space
  if (mcisProviderCell.length > 0) {
    mcisProviderCell = mcisProviderCell.slice(0, -2);
  }

  return mcisProviderCell;
}

//Tabulator Filter
//Define variables for input elements
var fieldEl = document.getElementById("filter-field");
var typeEl = document.getElementById("filter-type");
var valueEl = document.getElementById("filter-value");

// provider filtering / equel 고정
function providerFilter(data) {

  // case type like, equal, not eual
  // equal only
  if (typeEl.value == "=") {
    var vmCloudConnectionMap = webconsolejs["common/util"].calculateConnectionCount(
      data.vm
    );
    var valueElValue = valueEl.value;
    if (valueElValue != "") {
      if (vmCloudConnectionMap.has(valueElValue)) {
        return true;
      } else {
        return false;
      }
    }

  } else {
    return true;
  }

  return true
}

//Trigger setFilter function with correct parameters
function updateFilter() {
  var filterVal = fieldEl.options[fieldEl.selectedIndex].value;
  var typeVal = typeEl.options[typeEl.selectedIndex].value;

  var filter = filterVal == "provider" ? providerFilter : filterVal;

  if (filterVal == "provider") {
    typeEl.value = "=";
    typeEl.disabled = true;
  } else {
    typeEl.disabled = false;
  }

  if (filterVal) {
    table.setFilter(filter, typeVal, valueEl.value);
  }
}

//Update filters on value change
document.getElementById("filter-field").addEventListener("change", updateFilter);
document.getElementById("filter-type").addEventListener("change", updateFilter);
document.getElementById("filter-value").addEventListener("keyup", updateFilter);

//Clear filters on "Clear Filters" button click
document.getElementById("filter-clear").addEventListener("click", function () {
  fieldEl.value = "";
  typeEl.value = "=";
  valueEl.value = "";

  table.clearFilter();

});
// filter end

////////////////////////////////////////////////////// END TABULATOR ///////////////////////////////////////////////////

// function getCommonMcisDataCallbackSuccess(caller, data, mcisID) {
//   if (caller == "mcisexport") {

//     var mcisIndex = 0;
//     // console.log("mcisScriptExport start " + mcisID)
//     // console.log(data);
//     $("[id^='mcisID']").each(function () {
//       if (mcisID == $(this).val()) {
//         mcisIndex = $(this).attr("id").replace("mcisID", "")
//         return false;
//       }
//     });
//     //
//     // var mcisNameVal = $("#m_mcisName_" + mcisIndex).val();
//     var mcisCreateScript = JSON.stringify(data)
//     console.log(mcisCreateScript)
//     // $("#m_exportFileName_" + mcisIndex).val(mcisNameVal);
//     // $("#m_mcisExportScript_" + mcisIndex).val(mcisCreateScript);
//     $("#exportFileName").val(data.id);
//     $("#exportScript").val(mcisCreateScript);

//     saveToMcisAsJsonFile(mcisIndex);
//   } else if (caller == "refreshmcisdata") {
//     console.log(" gogo ")
//     // var mcisID = $("#selected_mcis_id").val();
//     // var mcisIndex = $("#selected_mcis_index").val();
//     // console.log("setMcisData " + mcisIndex)
//     // setMcisData(data, mcisIndex);
//     // console.log("clock List of Mcis ")
//     // clickListOfMcis(mcisID,mcisIndex);

//     updateMcisData(data, mcisID);
//   }
// }

var totalMcisListObj = new Object();
export var selectedMcisObj = new Object();
export var nsid = "";
var totalMcisStatusMap = new Map();
var totalVmStatusMap = new Map();
var totalCloudConnectionMap = new Map();
var nsid = ""


export function selectWorkspaceProject(userId) {
  var workspaceName = $("select-current-workspace").val()
  console.log("workspaceName", workspaceName)

}


document.addEventListener("DOMContentLoaded", renderMcisManage);

async function renderMcisManage() {
  console.log("life_cycle")
  
  ////// workspace SET //////
  var userId = $("#userid").val()
  console.log("userId === ", userId)
  var data = {
    pathParams: {
      userId: userId,
    },
  }

  var controller = "/api/" + "getworkspaceuserrolemappingbyworkspaceuser";
  const wsresponse = await webconsolejs["common/api/http"].commonAPIPost(
    controller,
    data
  )

  console.log("wsresponse", wsresponse)
  var workspaceList = [];
  var workspacesRespData = wsresponse.data.responseData.responseData // data

  workspacesRespData.forEach(item => {
    workspaceList.push(item.workspace.name);
  });
  console.log("workspacelist", workspaceList)

  var html = '<option value="">Select WorkSpace</option>'

  workspaceList.forEach(item => {
    html += '<option value="' + item + '">' + item + '</option>'
  })

  $("#select-current-workspace").empty()//
  $("#select-current-workspace").append(html)

  $("#select-current-workspace").on('change', async function () {
    console.log(" change ")
    var selectedValue = this.value;

    var data = {
      pathParams: {
        "workspace": selectedValue,
        "user": userId,
      },
    }
    var controller = "/api/" + "getworkspaceuserrolemappingbyuser";
    const prjresponse = await webconsolejs["common/api/http"].commonAPIPost(
      controller,
      data
    )
    console.log("prjresponse", prjresponse)


    // workspace 안에서 project목록 추출
    var projectList = [];
    var projects = prjresponse.data.responseData.responseData.projects // data

    projects.forEach(project => {
      projectList.push(project.name);
    });
    console.log("projectList", projectList)

    var html = '<option value="">Select Project</option>'
    html += '<option value="testns01">testns01</option>'

    projectList.forEach(item => {

      html += '<option value="' + item + '">' + item + '</option>'
    })
    $("#select-current-project").empty()
    $("#select-current-project").append(html)

    ////// project SET END//////
  })

  ////// workspace SET END //////


  ////// project SET //////
  $("#select-current-project").on('change', async function () {
    console.log(" change ")

    getMcisList();

    ////// project SET END//////
  })

  // var namespace = webconsolejs["common/util"].getCurrentProject()
}

async function getMcisList() {
  console.log("getMcisList")
  var projectId = $("#select-current-project").val()
  console.log("projectId", projectId)
  nsid = projectId

  var data = {
    pathParams: {
      nsId: nsid,
    },
  };
  //var controller = "targetController=getmcislist"
  var controller = "/api/" + "getmcislist";
  const response = await webconsolejs["common/api/http"].commonAPIPost(
    controller,
    data
  )
  
  // if (response.response.data.status.code != 200 && response.response.data.status.code != 201) {
  //   alert(response.response.data.responseData.message)
  // } else {
    var mcisList = response.data.responseData;
    console.log("mcisList : ", mcisList);
    getMcisListCallbackSuccess(nsid, mcisList);
  // }
}
// MCIS 목록 조회 후 화면에 Set

function getMcisListCallbackSuccess(caller, mcisList) {
  console.log("getMcisListCallbackSuccess");

  totalMcisListObj = mcisList.mcis;
  console.log("total mcis : ", totalMcisListObj);
  table.setData(totalMcisListObj);
  setToTalMcisStatus(); // mcis상태 표시 를 위해 필요
  setTotalVmStatus(); // mcis 의 vm들 상태표시 를 위해 필요
  //     setTotalConnection();// Mcis의 provider별 connection 표시를 위해 필요

  // displayMcisDashboard();

  //     // setMap();// MCIS를 가져와서 화면에 뿌려지면 vm정보가 있으므로 Map그리기

  //     AjaxLoadingShow(false);
}

function setToTalMcisStatus() {
  console.log("setToTalMcisStatus");
  try {
    for (var mcisIndex in totalMcisListObj) {
      var aMcis = totalMcisListObj[mcisIndex];

      var aMcisStatusCountMap = calculateMcisStatusCount(aMcis);
      console.log("aMcis.id : ", aMcis.id);
      console.log("mcisStatusMap ::: ", aMcisStatusCountMap);
      totalMcisStatusMap.set(aMcis.id, aMcisStatusCountMap);
    }
  } catch (e) {
    console.log("mcis status error", e);
  }
  displayMcisStatusArea();
}

// 해당 mcis에서 상태값들을 count : 1개 mcis의 상태는 1개만 있으므로 running, stop, terminate 중 1개만 1, 나머지는 0
// dashboard, mcis 에서 사용
function calculateMcisStatusCount(mcisData) {

  console.log("calculateMcisStatusCount");
  console.log("mcisData : ", mcisData);
  var mcisStatusCountMap = new Map();
  mcisStatusCountMap.set("running", 0);
  mcisStatusCountMap.set("stop", 0); // partial 도 stop으로 보고있음.
  mcisStatusCountMap.set("terminate", 0);
  try {
    var mcisStatus = mcisData.status;
    var mcisDispStatus = getMcisStatusDisp(mcisStatus); // 화면 표시용 status

    if (mcisStatus != "") {
      // mcis status 가 없는 경우는 skip
      if (mcisStatusCountMap.has(mcisDispStatus)) {
        mcisStatusCountMap.set(
          mcisDispStatus,
          mcisStatusCountMap.get(mcisDispStatus) + 1
        );
      }
    }
  } catch (e) {
    console.log("mcis status error", e);
  }
  // console.log(mcisStatusCountMap);
  return mcisStatusCountMap;
}

// Mcis 목록에서 vmStatus만 처리 : 화면표시는 display function에서
function setTotalVmStatus() {
  console.log("setTotalVmstatus")
  try {
    for (var mcisIndex in totalMcisListObj) {
      var aMcis = totalMcisListObj[mcisIndex];
      console.log("aMcis : ", aMcis);
      var vmStatusCountMap = calculateVmStatusCount(aMcis);
      totalVmStatusMap.set(aMcis.id, vmStatusCountMap);
    }
  } catch (e) {
    console.log("mcis status error");
  }
  displayVmStatusArea();
}

function displayMcisStatusArea() {
  console.log("displayMcisStatusArea");
  var sumMcisCnt = 0;
  var sumMcisRunningCnt = 0;
  var sumMcisStopCnt = 0;
  var sumMcisTerminateCnt = 0;
  totalMcisStatusMap.forEach((value, key) => {
    var statusRunning = value.get("running");
    var statusStop = value.get("stop");
    var statusTerminate = value.get("terminate");
    sumMcisRunningCnt += statusRunning;
    sumMcisStopCnt += statusStop;
    sumMcisTerminateCnt += statusTerminate;
    console.log("totalMcisStatusMap :: ", key, value);
  });
  sumMcisCnt = sumMcisRunningCnt + sumMcisStopCnt + sumMcisTerminateCnt;

  $("#total_mcis").text(sumMcisCnt);
  $("#mcis_status_running").text(sumMcisRunningCnt);
  $("#mcis_status_stopped").text(sumMcisStopCnt);
  $("#mcis_status_terminated").text(sumMcisTerminateCnt);
  console.log("displayMcisStatusArea ");
  console.log("running status count ", $("#mcis_status_running").text());
}

function calculateVmStatusCount(aMcis) {
  console.log("calculateVmStatusCount")
  // console.log("calculateVmStatusCount")
  // console.log(vmList)
  var sumVmCnt = 0;
  var vmStatusCountMap = new Map();
  vmStatusCountMap.set("running", 0);
  vmStatusCountMap.set("stop", 0); // partial 도 stop으로 보고있음.
  vmStatusCountMap.set("terminate", 0);

  try {
    if (aMcis.statusCount) {
      console.log("statusCount part", aMcis);
      var statusCountObj = aMcis.statusCount;
      console.log(statusCountObj);
      var countCreating = statusCountObj.countCreating;
      var countFailed = statusCountObj.countFailed;
      var countRebooting = statusCountObj.countRebooting;
      var countResuming = statusCountObj.countResuming;
      var countRunning = statusCountObj.countRunning;
      var countSuspended = statusCountObj.countSuspended;
      var countSuspending = statusCountObj.countSuspending;
      var countTerminated = statusCountObj.countTerminated;
      var countTerminating = statusCountObj.countTerminating;
      var countTotal = statusCountObj.countTotal;
      var countUndefined = statusCountObj.countUndefined;

      var sumEtc =
        Number(countCreating) +
        Number(countFailed) +
        Number(countRebooting) +
        Number(countResuming) +
        Number(countSuspending) +
        Number(countTerminated) +
        Number(countTerminating) +
        Number(countUndefined);

      vmStatusCountMap.set("running", Number(countRunning));
      vmStatusCountMap.set("stop", Number(countSuspended)); // partial 도 stop으로 보고있음.
      vmStatusCountMap.set("terminate", sumEtc);
    } else if (aMcis.vm) {
      console.log("statusCount part list part");
      vmList = aMcis.vm;
      for (var vmIndex in vmList) {
        var aVm = vmList[vmIndex];
        var vmStatus = aVm.status;
        var vmDispStatus = getVmStatusDisp(vmStatus);

        if (vmStatus != "") {
          // vm status 가 없는 경우는 skip
          if (vmStatusCountMap.has(vmDispStatus)) {
            vmStatusCountMap.set(
              vmDispStatus,
              vmStatusCountMap.get(vmDispStatus) + 1
            );
          }
        }
      }
    }
  } catch (e) {
    console.log("mcis status error");
  }
  return vmStatusCountMap;
}

// function displayMcisDashboard() {
//   console.log("displayMcisDashboard");
//   if (!isEmpty(totalMcisListObj) && totalMcisListObj.length > 0) {
//     //totalMcisCnt = mcisList.length;
//     var addMcis = "";
//     for (var mcisIndex in totalMcisListObj) {
//       var aMcis = totalMcisListObj[mcisIndex];
//       if (aMcis.id != "") {
//         addMcis += setMcisListTableRow(aMcis, mcisIndex);
//       }
//     } // end of mcis loop
//     $("#mcisList").empty();
//     $("#mcisList").append(addMcis);
//   } else {
//     var addMcis = "";
//     addMcis += "<tr>";
//     addMcis += '<td class="overlay hidden" data-th="" colspan="8">No Data</td>';
//     addMcis += "</tr>";
//     $("#mcisList").empty();
//     $("#mcisList").append(addMcis);
//   }
// }

function getMcisStatusDisp(mcisFullStatus) {
  console.log("getMcisStatus " + mcisFullStatus);
  var statusArr = mcisFullStatus.split("-");
  var returnStatus = statusArr[0].toLowerCase();

  if (mcisFullStatus.toLowerCase().indexOf("running") > -1) {
    returnStatus = "running";
  } else if (mcisFullStatus.toLowerCase().indexOf("suspend") > -1) {
    returnStatus = "stop";
  } else if (mcisFullStatus.toLowerCase().indexOf("terminate") > -1) {
    returnStatus = "terminate";
    // TODO : partial도 있는데... 처리를 어떻게 하지??
  } else {
    returnStatus = "terminate";
  }
  console.log("after status " + returnStatus);
  return returnStatus;
}


// // 화면 표시
function displayVmStatusArea() {
  var sumVmCnt = 0;
  var sumVmRunningCnt = 0;
  var sumVmStopCnt = 0;
  var sumVmTerminateCnt = 0;
  totalVmStatusMap.forEach((value, key) => {
    var statusRunning = value.get("running");
    var statusStop = value.get("stop");
    var statusTerminate = value.get("terminate");
    sumVmRunningCnt += statusRunning;
    sumVmStopCnt += statusStop;
    sumVmTerminateCnt += statusTerminate;
  });
  sumVmCnt = sumVmRunningCnt + sumVmStopCnt + sumVmTerminateCnt;
  $("#total_vm").text(sumVmCnt);
  $("#vm_status_running").text(sumVmRunningCnt);
  $("#vm_status_stopped").text(sumVmStopCnt);
  $("#vm_status_terminated").text(sumVmTerminateCnt);
}

export function mcisLifeCycle(type) {
  console.log("hello~", type)
  console.log("hello~", checked_array)
  /*
  {
    "mcisID":mcis01,
    "type":reboot
  }
  */
  for (const mcis of checked_array) {
    console.log(mcis.id)
    let data = {
      pathParams: {
        nsId: nsid,
        mcisId: mcis.id,
      },
      queryParams: {
        "action": type
      }
    };
    let controller = "/api/" + "controllifecycle";
    let response = webconsolejs["common/api/http"].commonAPIPost(
      controller,
      data
    );
    console.log(response)
  }
}

// VM 상태를 UI에서 표현하는 방식으로 변경
function getVmStatusDisp(vmFullStatus) {
  console.log("getVmStatusDisp " + vmFullStatus);
  var returnVmStatus = vmFullStatus.toLowerCase() // 소문자로 변환

  const VM_STATUS_RUNNING = "running"
  const VM_STATUS_STOPPED = "stop"
  const VM_STATUS_RESUMING = "resuming";
  const VM_STATUS_INCLUDE = "include"
  const VM_STATUS_SUSPENDED = "suspended"
  const VM_STATUS_TERMINATED = "terminated"
  const VM_STATUS_FAILED = "failed"

  if (returnVmStatus == VM_STATUS_RUNNING) {
    returnVmStatus = "running"
  } else if (returnVmStatus == VM_STATUS_TERMINATED) {
    returnVmStatus = "terminate"
  } else if (returnVmStatus == VM_STATUS_FAILED) {
    returnVmStatus = "terminate"
  } else {
    returnVmStatus = "stop"
  }
  return returnVmStatus
}

function getVmStatusClass(vmDispStatus) {
  var vmStatusClass = "bg-info";
  if (vmDispStatus == "running") {
    vmStatusClass = "bg-info"
  } else if (vmDispStatus == "include") {
    vmStatusClass = "bg-red"
  } else if (vmDispStatus == "suspended") {
    vmStatusClass = "bg-red"
  } else if (vmDispStatus == "terminated") {
    vmStatusClass = "bg-secondary"
  } else {
    vmStatusClass = "bg-secondary"
  }
  return vmStatusClass;
}

/////////////////////////////////////////////////////////////////////////////////////////////////
// changeLifeCycle -> callMcisLifeCycle -> util.callMcisLifeCycle -> callbackMcisLifeCycle 순으로 호출 됨
// LifeCycle


// MCIS 제어 : 선택한 MCIS내 vm들의 상태 변경 
// Dashboard 와 MCIS Manage 에서 같이 쓰므로
// callAAA -> mcisLifeCycle 호출 -> callBackAAA로 결과값전달


/////////////// MCIS Handling /////////////////
export function deleteMcis(type) {

  for (const mcis of checked_array) {
    console.log(mcis.id)
    let data = {
      pathParams: {
        nsId: nsid,
        mcisId: mcis.id,
      }
    };
    let controller = "/api/" + "delmcis";
    let response = webconsolejs["common/api/http"].commonAPIPost(
      controller,
      data
    );
    console.log(response)
  }
}


// ////////////// VM Handling ///////////
// export function addNewVirtualMachine() {
//   console.log("addNewVirtualMachine")
//   var mcis_id = $("#mcis_id").val()
//   var value = document.getElementById("#mcis_name").val();



//   var mcis_name = $("#mcis_name").val()
//   console.log("mcis_name",value)
//   $("#extend_mcis_name").val(value)
//   // location.href = "/Manage/MCIS/reg/"+mcis_id+"/"+mcis_name
//   // location.href = "/operation/manages/mcismng/regform/" + mcis_id + "/" + mcis_name;
// }