/**
 * Copyright 2004-present Facebook. All Rights Reserved.
 *
 * @format
 * @flow
 */

'use strict';
import type {Overlay} from './overlays';
import type {
  IgnitionState,
  SiteMap,
  Element,
  Node,
  Location,
  TopologyConfig,
} from '../../NetworkContext';
import type {
  TopologyType,
  LinkType as Link,
} from '../../../shared/types/Topology';

import {scaleLinear} from 'd3-scale';
import {interpolateHcl} from 'd3-interpolate';
import {Feature, Layer} from 'react-mapbox-gl';
import {get} from 'lodash-es';
import {getLinkGolay} from '../../helpers/TgFeatures';
import {
  GOLAY_COLORS,
  LinkOverlayColors,
  METRIC_COLOR_RANGE,
} from '../../constants/LayerConstants';
import LinkOverlayContext from '../../LinkOverlayContext';
import {LinkType, NodeType} from '../../../thrift/gen-nodejs/Topology_types';
import {
  mapboxShouldAcceptClick,
  hasLinkEverGoneOnline,
} from '../../helpers/NetworkHelpers';
import PropTypes from 'prop-types';
import React from 'react';
import {
  SCAN_MAX_COVERAGE_ANGLE,
  SCAN_MAX_RX_DISTANCE,
  SNR_THRESHOLD_MCS9,
} from '../../constants/NetworkConstants';
import {withStyles} from '@material-ui/core/styles';

const styles = _theme => ({});

// === Topology link Lines ===
const LINE_PAINT = {
  'line-color': ['get', 'linkColor'],
  'line-width': 8,
};
const LINE_BACKUP_CN_PAINT = {...LINE_PAINT, 'line-dasharray': [0.05, 1.5]};
const LINE_WIRED_INTERSITE_PAINT = {
  ...LINE_PAINT,
  'line-dasharray': [0.02, 1.5],
};
const LINE_LAYOUT = {
  'line-join': 'round',
  'line-cap': 'round',
};
const LinkRenderType = {
  HIDDEN: null,
  NORMAL: 'link-normal',
  BACKUP_CN: 'link-backup-cn',
  WIRED_INTERSITE: 'link-wired-intersite',
};

// === Selected link casing ===
const LINE_CASING_PAINT = {
  'line-gap-width': LINE_PAINT['line-width'],
  'line-color': '#0077ff',
  'line-width': 4,
  'line-opacity': 0.6,
};

// === Link overlay text (e.g. for link metrics) ===
const LINE_TEXT_PAINT = {
  'text-color': '#fff',
  'text-halo-color': '#444',
  'text-halo-width': 1,
  'text-halo-blur': 1,
};
const LINE_TEXT_LAYOUT = {
  'text-field': '{text}',
  'text-size': 14,
  'text-anchor': 'center',
  'text-allow-overlap': true,
  'text-ignore-placement': true,
  // Place the text on the line...
  // TODO use 'line-center' (mapbox-gl-js >= 0.47.0)
  'symbol-placement': 'line',
  // TODO weird behavior... should be very high (~10000) to avoid duplication,
  // but text won't always appear on the line without a low value (~100)
  'symbol-spacing': 80,
};

// === "Search Nearby" links ===
const SEARCH_NEARBY_LINE_PAINT = {
  'line-color': '#aec6cf',
  'line-width': 3,
  'line-dasharray': [1, 2],
};
const SEARCH_NEARBY_FILL_PAINT = {
  'fill-color': '#aec6cf',
  'fill-opacity': 0.3,
};

type Props = {
  overlay: Overlay,
  ignitionState: IgnitionState,
  routes: {
    links: {},
    node: ?Node,
    nodes: Set<string>,
  },
  siteMap: SiteMap,
  topology: TopologyType,
  topologyConfig: TopologyConfig,
  selectedLinks: Array<Element>,
  selectedNodeName: string,
  nearbyNodes: {
    [string]: Array<TopologyScanInfo>,
  },
  ctrlVersion: string,
  nodeMap: {
    [string]: Node,
  },
  onSelectLinkChange: string => any,
  onLinkMouseEnter: string => any,
  onLinkMouseLeave: string => any,
  offlineWhitelist: {
    links: {[string]: boolean},
    nodes: {[string]: boolean},
  },
};

type TopologyScanInfo = {
  bestSnr: number,
  responderInfo: {
    pos: Location,
    addr: string,
  },
};

type CnLinkInfoMap = {
  [string]: CnLinkInfo,
};

type CnLinkInfo = {
  links: Array<Link>,
  isBackupAlive: boolean,
  isSelected: boolean,
  is_backup_cn_link: boolean,
};

type TopologyLineMap = {
  [string]: TopologyLayer,
};

type TopologyLayer = {
  paint: {[string]: any},
  features: Array<any>,
};

class LinksLayer extends React.Component<Props> {
  getLinkColor(link, values: Array<number> | void) {
    const {overlay, ignitionState, routes, offlineWhitelist} = this.props;
    const {igCandidates} = ignitionState;

    if (overlay.type === 'metric') {
      return this.getMetricLinkColor(link, values);
    }
    if (overlay.type === 'golay') {
      if (values === undefined) {
        return LinkOverlayColors.metric.missing.color;
      }
      return GOLAY_COLORS[values];
    }
    if (routes.links && Object.keys(routes.links).length !== 0) {
      if (routes.links.hasOwnProperty(link.name)) {
        return LinkOverlayColors.metric.excellent.color;
      } else {
        return LinkOverlayColors.metric.missing.color;
      }
    }
    // Link lines not based on metrics (i.e. health)
    if (link.is_alive) {
      return LinkOverlayColors.health.healthy.color;
    } else if (igCandidates.find(({linkName}) => linkName === link.name)) {
      return LinkOverlayColors.health.igniting.color;
    } else if (
      // link is offline on purpose
      !link.is_alive &&
      !hasLinkEverGoneOnline(link, offlineWhitelist)
    ) {
      return LinkOverlayColors.health.unknown.color;
    } else {
      return LinkOverlayColors.health.unhealthy.color;
    }
  }

  getMetricLinkColor(link, metricValues: Array<number> | void) {
    if (!metricValues) {
      return;
    }
    const {overlay} = this.props;
    const rangeColorFunc = this.getRangeColorFunc(
      overlay.range,
      overlay.colorRange,
    );
    return metricValues.map(metricValue =>
      metricValue !== null
        ? rangeColorFunc(metricValue)
        : LinkOverlayColors.metric.missing.color,
    );
  }

  getMetricValues(link, metricData): Array<number> {
    const {overlay} = this.props;
    const A = get(metricData, [link.name, 'A'], null);
    const Z = get(metricData, [link.name, 'Z'], null);
    if (typeof overlay.aggregate === 'function') {
      const aggregate = overlay.aggregate; // fixes a flow bug
      return [aggregate(A), aggregate(Z)];
    }
    return [get(A, [overlay.id], null), get(Z, [overlay.id], null)];
  }

  getMetricText(link, metricValues: Array<number>): Array<string | number> {
    return metricValues.map(value => {
      if (typeof this.props.overlay.formatText === 'function') {
        return this.props.overlay.formatText(link, value);
      }
      if (value === null || typeof value === 'undefined') {
        return '';
      }
      return value;
    });
  }

  getGolayValue(overlay, golayValues) {
    if (overlay.id === 'golay_tx') {
      if (golayValues && golayValues.txGolayIdx) {
        return golayValues.txGolayIdx;
      } else {
        return undefined;
      }
    } else if (golayValues && golayValues.rxGolayIdx) {
      return golayValues.rxGolayIdx;
    } else {
      return undefined;
    }
  }

  getRangeColorFunc = (domain, customColorRange) => {
    return scaleLinear()
      .domain(domain)
      .range(customColorRange || METRIC_COLOR_RANGE)
      .interpolate(interpolateHcl);
  };

  mapLinksToRenderType() {
    // Map some links to a render type (for special cases)
    const {topology, selectedLinks, selectedNodeName} = this.props;

    // Create map of CN nodes (as an optimization)
    const cnNodeMap = {};
    topology.nodes.forEach(node => {
      if (node.node_type === NodeType.CN) {
        cnNodeMap[node.name] = node;
      }
    });
    const getCnNode = link =>
      cnNodeMap.hasOwnProperty(link.a_node_name)
        ? cnNodeMap[link.a_node_name]
        : cnNodeMap.hasOwnProperty(link.z_node_name)
        ? cnNodeMap[link.z_node_name]
        : null;

    // Get info about all links to each CN (in one iteration)
    const cnLinkInfo: CnLinkInfoMap = {};
    topology.links.forEach(link => {
      if (link.link_type === LinkType.ETHERNET) {
        return;
      }
      const cnNode = getCnNode(link);
      if (cnNode) {
        if (!cnLinkInfo.hasOwnProperty(cnNode.name)) {
          cnLinkInfo[cnNode.name] = {
            // List of all links to this CN
            links: [],

            // Is any CN backup link alive?
            isBackupAlive: false,

            // Is this CN or any link to this CN selected?
            isSelected: selectedNodeName === cnNode.name,
          };
        }
        const info = cnLinkInfo[cnNode.name];
        info.links.push(link);
        if (link.is_backup_cn_link && link.is_alive) {
          info.isBackupAlive = true;
        }
        if (selectedLinks.hasOwnProperty(link.name)) {
          info.isSelected = true;
        }
      }
    });

    // For backup CN links, only render whichever link is online (or the
    // primary link if all offline) - show all links when any link is selected
    const linkToRenderType = {};
    objectValuesTypesafe<CnLinkInfo>(cnLinkInfo).forEach(
      ({links, isBackupAlive, isSelected}) => {
        links.forEach(link => {
          let renderType;
          if (link.is_backup_cn_link) {
            // Backup CN link
            renderType =
              isSelected || link.is_alive
                ? LinkRenderType.BACKUP_CN
                : LinkRenderType.HIDDEN;
          } else {
            // Primary CN link
            renderType =
              isSelected || link.is_alive || !isBackupAlive
                ? LinkRenderType.NORMAL
                : LinkRenderType.HIDDEN;
          }
          linkToRenderType[link.name] = renderType;
        });
      },
    );
    return linkToRenderType;
  }

  toDegrees(angle) {
    return angle * (180 / Math.PI);
  }

  toRadians(angle) {
    return (angle * Math.PI) / 180.0;
  }

  calcBearing(p1, p2) {
    // Calculates an initial bearing from p1 to p2
    const lat1 = this.toRadians(p1[0]);
    const lon1 = this.toRadians(p1[1]);
    const lat2 = this.toRadians(p2[0]);
    const lon2 = this.toRadians(p2[1]);

    const y = Math.sin(lat2 - lat1) * Math.cos(lon2);
    const x =
      Math.cos(lon1) * Math.sin(lon2) -
      Math.sin(lon1) * Math.cos(lon2) * Math.cos(lat2 - lat1);
    return this.toDegrees(Math.atan2(y, x));
  }

  calcDestinationPoint(origin, bearing, distance) {
    // Calculates a destination point given distance and bearing from origin
    const R = 6371e3; // Earth's radius in meters
    const d = distance / R; // algular distance in radians
    const b = this.toRadians(bearing); // convert to radians
    const lat = this.toRadians(origin[0]); // convert to radians
    const lng = this.toRadians(origin[1]); // convert to radians

    const lng2 = Math.asin(
      Math.sin(lng) * Math.cos(d) + Math.cos(lng) * Math.sin(d) * Math.cos(b),
    );
    const lat2 =
      lat +
      Math.atan2(
        Math.sin(b) * Math.sin(d) * Math.cos(lng),
        Math.cos(d) - Math.sin(lng) * Math.sin(lng2),
      );

    // convert back to degrees
    return [this.toDegrees(lat2), this.toDegrees(lng2)];
  }

  getNearbyCoverageCoordinates(
    txLocation,
    responders: Array<TopologyScanInfo>,
  ) {
    /**
     * Steps:
     * 1. Determine best responder with valid SNR for each TX node that has
     *    nearby nodes.
     * 2. Calculate bearing from TX node to RX node based on geo coordinates.
     * 3. Calculate polygon points based on constant distance and coverage
     *    offset.
     */
    const txPos = [txLocation.longitude, txLocation.latitude];
    const coordinates = [];

    // find best responder with valid coordinates
    let bestResponder = null;
    responders.forEach(responder => {
      if (
        responder.responderInfo &&
        responder.responderInfo.pos &&
        responder.bestSnr >= SNR_THRESHOLD_MCS9
      ) {
        if (!bestResponder || responder.bestSnr > bestResponder.bestSnr) {
          bestResponder = responder;
        }
      }
    });

    // if found, build coverage polygon
    if (bestResponder !== null) {
      const rxPos = [
        bestResponder.responderInfo.pos.longitude,
        bestResponder.responderInfo.pos.latitude,
      ];

      // calculate bearing
      const bearing = this.calcBearing(txPos, rxPos);

      // build list of polygon coordinates
      coordinates.push(txPos);
      for (
        let i = -SCAN_MAX_COVERAGE_ANGLE / 2;
        i <= SCAN_MAX_COVERAGE_ANGLE / 2;
        i += SCAN_MAX_COVERAGE_ANGLE / 10.0
      ) {
        coordinates.push(
          this.calcDestinationPoint(txPos, bearing + i, SCAN_MAX_RX_DISTANCE),
        );
      }
      coordinates.push(txPos);
    }

    return coordinates;
  }

  handleLinkClick = link => evt => {
    // Handle clicking on a link
    if (mapboxShouldAcceptClick(evt)) {
      this.props.onSelectLinkChange(link.name);
    }
  };

  render() {
    return (
      <LinkOverlayContext.Consumer>
        {this.renderOverlayContext}
      </LinkOverlayContext.Consumer>
    );
  }

  renderOverlayContext = overlayContext => {
    const {
      topology,
      nodeMap,
      selectedLinks,
      siteMap,
      onLinkMouseEnter,
      onLinkMouseLeave,
      nearbyNodes,
      overlay,
    } = this.props;
    const {metricData} = overlayContext;
    const linkToRenderType = this.mapLinksToRenderType();

    // Draw links in topology
    const topologyLines: TopologyLineMap = {
      [LinkRenderType.NORMAL]: {paint: LINE_PAINT, features: []},
      [LinkRenderType.BACKUP_CN]: {paint: LINE_BACKUP_CN_PAINT, features: []},
      [LinkRenderType.WIRED_INTERSITE]: {
        paint: LINE_WIRED_INTERSITE_PAINT,
        features: [],
      },
    };
    const lineCasingFeatures = []; // casing around selected links
    topology.links.forEach(link => {
      if (
        !nodeMap.hasOwnProperty(link.a_node_name) ||
        !nodeMap.hasOwnProperty(link.z_node_name)
      ) {
        return;
      }

      const siteA = siteMap[nodeMap[link.a_node_name].site_name];
      const siteZ = siteMap[nodeMap[link.z_node_name].site_name];

      // Skip intra-site Ethernet links
      if (link.link_type === LinkType.ETHERNET) {
        if (siteA.name === siteZ.name) {
          return;
        }
        linkToRenderType[link.name] = LinkRenderType.WIRED_INTERSITE;
      }

      // Determine which array to push to based on the link's role
      // (Mapbox does not support data-driven properties for 'line-dasharray')
      const renderType = linkToRenderType.hasOwnProperty(link.name)
        ? linkToRenderType[link.name]
        : LinkRenderType.NORMAL;
      if (renderType === LinkRenderType.HIDDEN) {
        return;
      }
      const features = topologyLines[renderType].features;

      const featureParams = {
        key: 'link-layer-' + link.name,
        onMouseEnter: onLinkMouseEnter,
        onMouseLeave: onLinkMouseLeave,
        onClick: this.handleLinkClick(link),
      };
      if (overlay.type === 'golay') {
        const {ctrlVersion, topologyConfig} = this.props;
        const golayValues = getLinkGolay(ctrlVersion, link, topologyConfig);
        const value = this.getGolayValue(overlay, golayValues);
        const linkColor = this.getLinkColor(link, value);
        features.push(
          <Feature
            {...featureParams}
            coordinates={[
              [siteA.location.longitude, siteA.location.latitude],
              [siteZ.location.longitude, siteZ.location.latitude],
            ]}
            properties={{
              linkColor,
              text: value,
            }}
          />,
        );
      } else {
        const metricValues = this.getMetricValues(link, metricData);
        const linkColor = this.getLinkColor(link, metricValues);
        if (Array.isArray(linkColor) && linkColor.length === 2) {
          const metricText = this.getMetricText(link, metricValues);

          // Draw 2 partial lines (split at the midpoint)
          const midpoint = [
            (siteA.location.longitude + siteZ.location.longitude) / 2,
            (siteA.location.latitude + siteZ.location.latitude) / 2,
          ];
          features.push(
            <Feature
              {...featureParams}
              coordinates={[
                [siteA.location.longitude, siteA.location.latitude],
                midpoint,
              ]}
              properties={{
                linkColor: linkColor[0],
                text: metricText[0],
              }}
            />,
          );
          features.push(
            <Feature
              {...featureParams}
              coordinates={[
                midpoint,
                [siteZ.location.longitude, siteZ.location.latitude],
              ]}
              properties={{
                linkColor: linkColor[1],
                text: metricText[1],
              }}
            />,
          );
        } else {
          // Draw single line
          features.push(
            <Feature
              {...featureParams}
              coordinates={[
                [siteA.location.longitude, siteA.location.latitude],
                [siteZ.location.longitude, siteZ.location.latitude],
              ]}
              properties={{linkColor}}
            />,
          );
        }
      }

      // Draw casing over selected links
      if (selectedLinks.hasOwnProperty(link.name)) {
        lineCasingFeatures.push(
          <Feature
            key={'line-layer-' + link.name}
            onMouseEnter={onLinkMouseEnter}
            onMouseLeave={onLinkMouseLeave}
            coordinates={[
              [siteA.location.longitude, siteA.location.latitude],
              [siteZ.location.longitude, siteZ.location.latitude],
            ]}
          />,
        );
      }
    });

    // Draw "nearby" site links (from topology scan)
    const searchNearbyLineFeatures = [];
    objectEntriesTypesafe<string, Array<TopologyScanInfo>>(nearbyNodes).forEach(
      ([txNode, responders]) => {
        if (responders) {
          const txLocation = siteMap[nodeMap[txNode].site_name].location;
          responders.forEach(responder => {
            const rxLocation = responder.responderInfo.pos;
            if (rxLocation) {
              searchNearbyLineFeatures.push(
                <Feature
                  key={'nearby-' + txNode + '-' + responder.responderInfo.addr}
                  coordinates={[
                    [txLocation.longitude, txLocation.latitude],
                    [rxLocation.longitude, rxLocation.latitude],
                  ]}
                />,
              );
            }
          });
        }
      },
    );

    // Draw "nearby" coverage (from topology scan)
    const searchNearbyCoverageFeatures = [];
    objectEntriesTypesafe<string, Array<TopologyScanInfo>>(nearbyNodes).forEach(
      ([txNode, responders]) => {
        if (responders) {
          const txLocation = siteMap[nodeMap[txNode].site_name].location;
          const coordinates = this.getNearbyCoverageCoordinates(
            txLocation,
            responders,
          );

          // add to list of figures
          searchNearbyCoverageFeatures.push(
            <Feature key={'nearby-fill'} coordinates={[coordinates]} />,
          );
        }
      },
    );

    return (
      <>
        {lineCasingFeatures ? (
          <Layer
            type="line"
            key={'link-casing-layer'}
            id={'link-casing-layer'}
            paint={LINE_CASING_PAINT}>
            {lineCasingFeatures}
          </Layer>
        ) : null}

        {objectEntriesTypesafe<string, TopologyLayer>(topologyLines).map(
          ([id, {paint, features}]) => [
            <Layer
              type="line"
              key={id}
              id={id}
              paint={paint}
              layout={LINE_LAYOUT}>
              {features}
            </Layer>,
            <Layer
              type="symbol"
              key={id + '-text'}
              id={id + '-text'}
              sourceId={id}
              paint={LINE_TEXT_PAINT}
              layout={LINE_TEXT_LAYOUT}
            />,
          ],
        )}

        {searchNearbyCoverageFeatures ? (
          <Layer
            type="fill"
            key={'nearby-fill-layer'}
            id={'nearby-fill-layer'}
            paint={SEARCH_NEARBY_FILL_PAINT}>
            {searchNearbyCoverageFeatures}
          </Layer>
        ) : null}

        {searchNearbyLineFeatures ? (
          <Layer
            type="line"
            key={'nearby-link-layer'}
            id={'nearby-link-layer'}
            paint={SEARCH_NEARBY_LINE_PAINT}
            layout={LINE_LAYOUT}>
            {searchNearbyLineFeatures}
          </Layer>
        ) : null}
      </>
    );
  };
}

function objectEntriesTypesafe<T, K>(object): Array<[T, K]> {
  return ((Object.entries(object): any): Array<[T, K]>);
}

function objectValuesTypesafe<T>(object): Array<T> {
  return ((Object.values(object): any): Array<T>);
}

LinksLayer.propTypes = {
  onLinkMouseEnter: PropTypes.func,
  onLinkMouseLeave: PropTypes.func,
  topology: PropTypes.object.isRequired,
  topologyConfig: PropTypes.object.isRequired,
  selectedLinks: PropTypes.object.isRequired, // {linkName: thrift::Link}
  onSelectLinkChange: PropTypes.func.isRequired,
  selectedNodeName: PropTypes.string,
  nodeMap: PropTypes.object.isRequired,
  siteMap: PropTypes.object.isRequired,
  overlay: PropTypes.object.isRequired,
  ignitionState: PropTypes.object.isRequired,
  nearbyNodes: PropTypes.object,
  routes: PropTypes.object.isRequired,
};

export default withStyles(styles)(LinksLayer);