/**
 * Copyright 2004-present Facebook. All Rights Reserved.
 *
 * @format
 */

const {
  getAllNetworkConfigs,
  getAllTopologyNames,
  refreshNetworkHealth,
  refreshWirelessControllerCache,
  refreshTopologies,
  runNowAndWatchForTopologyUpdate,
  scheduleScansUpdate,
  //watchForTopologyUpdate,
} = require('./model');
const {refreshAnalyzerData} = require('./analyzer_data');
const {runNowAndSchedule} = require('../scheduler');

const _ = require('lodash');
const logger = require('../log')(module);

const IM_SCAN_POLLING_ENABLED = process.env.IM_SCAN_POLLING_ENABLED
  ? process.env.IM_SCAN_POLLING_ENABLED === '1'
  : 0;

const MS_IN_SEC = 1000;
const MS_IN_MIN = 60 * 1000;

const DEFAULT_SCAN_POLL_INTERVAL = 1 * MS_IN_MIN;
const DEFAULT_TOPOLOGY_REFRESH_INTERVAL = 5 * MS_IN_SEC;
const HEALTH_REFRESH_INTERVAL = 30 * MS_IN_SEC;
const WIRELESS_CONTROLLER_REFRESH_INTERVAL = 1 * MS_IN_MIN;

function startPeriodicTasks() {
  logger.debug('periodic: starting periodic tasks...');
  const config = getAllNetworkConfigs();

  // wireless controller data is fetched from BQS
  runNowAndSchedule(
    refreshWirelessControllerData,
    WIRELESS_CONTROLLER_REFRESH_INTERVAL,
  );

  runNowAndSchedule(refreshHealthData, HEALTH_REFRESH_INTERVAL);

  // setup topology streaming, only query when something changed
  runNowAndWatchForTopologyUpdate();

  // regular poll for status (CtrlStatus, IgnitionState, UpgradeState)
  runNowAndSchedule(
    //scheduleCtrlStatusIgnitionStateUpgradeStateUpdate,
    refreshTopologies,
    _.get(config, 'refresh_interval', DEFAULT_TOPOLOGY_REFRESH_INTERVAL),
  );

  if (IM_SCAN_POLLING_ENABLED && false) {
    logger.debug('IM_SCAN_POLLING_ENABLED is set');

    runNowAndSchedule(
      scheduleScansUpdate,
      _.get(config, 'scan_poll_interval', DEFAULT_SCAN_POLL_INTERVAL),
    );
  }
}

function refreshHealthData() {
  logger.debug('periodic: refreshing health cache');
  const allConfigs = getAllTopologyNames();
  allConfigs.forEach(configName => {
    logger.debug(
      'periodic: refreshing cache (health, analyzer) for %s',
      configName,
    );
    refreshNetworkHealth(configName);
    refreshAnalyzerData(configName);
  });
}

function refreshWirelessControllerData() {
  logger.debug('periodic: refreshing wireless controller cache');
  const allConfigs = getAllNetworkConfigs();
  Object.keys(allConfigs).forEach(configName => {
    const config = allConfigs[configName];
    // verify a wireless controller is defined
    if (!config.wireless_controller) {
      return;
    }
    logger.debug(
      'periodic: refreshing cache (wireless controller) for %s',
      configName,
    );
    refreshWirelessControllerCache(configName);
  });
}

module.exports = {
  startPeriodicTasks,
};