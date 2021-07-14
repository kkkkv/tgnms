/**
 * Copyright 2004-present Facebook. All Rights Reserved.
 *
 * @format
 * @flow
 */

import * as React from 'react';
import Autocomplete from '@material-ui/lab/Autocomplete';
import Button from '@material-ui/core/Button';
import Grid from '@material-ui/core/Grid';
import TaskBasedConfigModal from '@fbcnms/tg-nms/app/components/taskBasedConfig/TaskBasedConfigModal';
import TextField from '@material-ui/core/TextField';
import WlanMacEditor from '@fbcnms/tg-nms/app/views/map/mappanels/TopologyBuilderPanel/WlanMacEditor';
import useForm from '@fbcnms/tg-nms/app/hooks/useForm';
import useLiveRef from '@fbcnms/tg-nms/app/hooks/useLiveRef';
import {FORM_TYPE} from '@fbcnms/tg-nms/app/constants/MapPanelConstants';
import {NodeTypeValueMap} from '@fbcnms/tg-nms/shared/types/Topology';
import {TOPOLOGY_ELEMENT} from '@fbcnms/tg-nms/app/constants/NetworkConstants';
import {cloneDeep, merge} from 'lodash';
import {useModalState} from '@fbcnms/tg-nms/app/hooks/modalHooks';
import {useTopologyBuilderContext} from '@fbcnms/tg-nms/app/contexts/TopologyBuilderContext';

const NODE_TYPE_OPTIONS = {
  CN: {label: 'CN', pop_node: false, node_type: NodeTypeValueMap.CN},
  DN: {label: 'DN', pop_node: false, node_type: NodeTypeValueMap.DN},
  POP: {label: 'POP', pop_node: true, node_type: NodeTypeValueMap.DN},
};

export default function NodeForm({index}: {index: number}) {
  const {isOpen, open, close} = useModalState();
  const {
    elementType,
    formType,
    updateTopology,
    newTopology,
    initialParams,
  } = useTopologyBuilderContext();
  const updateTopologyRef = useLiveRef(updateTopology);

  const {nodes, site} = newTopology;
  const nodesRef = useLiveRef(nodes);
  const siteName = React.useMemo(() => {
    if (
      elementType === TOPOLOGY_ELEMENT.NODE &&
      formType === FORM_TYPE.EDIT &&
      initialParams.nodes.length > 0
    ) {
      return initialParams.nodes[0].site_name;
    }
    return site.name;
  }, [site, elementType, formType, initialParams]);

  const node = React.useMemo(() => {
    if (elementType !== TOPOLOGY_ELEMENT.SITE) {
      if (!initialParams.nodes) {
        return {};
      }
      return cloneDeep(initialParams.nodes[index]);
    }
    return cloneDeep(nodesRef.current[index]);
  }, [nodesRef, initialParams, elementType, index]);

  const nodeType = React.useMemo(() => {
    if (!node) {
      return NODE_TYPE_OPTIONS.DN;
    }
    const type = Object.keys(NODE_TYPE_OPTIONS).find(
      key =>
        node.pop_node === NODE_TYPE_OPTIONS[key].pop_node &&
        node.node_type === NODE_TYPE_OPTIONS[key].node_type,
    );
    return NODE_TYPE_OPTIONS[type ?? 'DN'];
  }, [node]);

  const {formState, updateFormState, handleInputChange} = useForm({
    initialState: {
      name: `${siteName}_${index}`,
      mac_addr: '',
      pop_node: false,
      node_type: NodeTypeValueMap.DN,
      wlan_mac_addrs: [],
      site_name: siteName,
      nodeType,
      ...node,
    },
  });
  const updateFormStateRef = useLiveRef(updateFormState);

  React.useEffect(() => {
    if (elementType === TOPOLOGY_ELEMENT.SITE) {
      updateFormStateRef.current({
        site_name: siteName,
        name: `${siteName}_${index}`,
      });
    }
  }, [siteName, elementType, index, updateFormStateRef]);

  React.useEffect(() => {
    updateFormStateRef.current({
      nodeType,
    });
  }, [nodeType, updateFormStateRef]);

  React.useEffect(() => {
    const newNodes = nodesRef.current ? cloneDeep(nodesRef.current) : [];
    newNodes[index] = merge(cloneDeep(node), formState);
    updateTopologyRef.current({nodes: newNodes});
  }, [node, index, formState, nodesRef, updateTopologyRef]);

  const handleTypeSelected = React.useCallback(
    (e: SyntheticInputEvent<HTMLInputElement>) => {
      const type = e.target.innerText ?? NODE_TYPE_OPTIONS.DN.label;
      const nodeTypeOptions = NODE_TYPE_OPTIONS[type];
      updateFormStateRef.current({
        ...nodeTypeOptions,
        nodeType: nodeTypeOptions,
      });
    },
    [updateFormStateRef],
  );

  const handleAddWlanMac = React.useCallback(() => {
    const newMacs = [...formState.wlan_mac_addrs, ''];
    updateFormStateRef.current({wlan_mac_addrs: newMacs});
  }, [formState, updateFormStateRef]);

  return (
    <Grid container direction="column" spacing={2}>
      <Grid item>
        <Autocomplete
          options={Object.values(NODE_TYPE_OPTIONS)}
          getOptionLabel={option => option.label}
          onChange={handleTypeSelected}
          value={formState.nodeType}
          renderInput={params => (
            <TextField
              {...params}
              InputLabelProps={{shrink: true}}
              margin="dense"
              label="Node Type"
            />
          )}
        />
      </Grid>
      <Grid item>
        <TextField
          data-testId="node-name-input"
          id="name"
          key="name"
          label="Node Name"
          InputLabelProps={{shrink: true}}
          margin="dense"
          fullWidth
          value={formState.name}
          onChange={handleInputChange(val => ({name: val}))}
        />
      </Grid>
      <Grid item>
        <TextField
          id="mac_addr"
          key="mac_addr"
          label="Node MAC Address"
          InputLabelProps={{shrink: true}}
          margin="dense"
          fullWidth
          value={formState.mac_addr}
          onChange={handleInputChange(val => ({mac_addr: val}))}
        />
      </Grid>
      <Grid item>
        {formState.wlan_mac_addrs &&
          formState.wlan_mac_addrs.map((wlan_mac, index) => (
            <WlanMacEditor
              index={index}
              wlan_mac={wlan_mac}
              wlan_mac_addrs={formState.wlan_mac_addrs}
              onUpdate={updateFormState}
              nodeName={formState.name}
            />
          ))}
        {formState.wlan_mac_addrs.length < 4 && (
          <Button color="primary" onClick={handleAddWlanMac}>
            Add Radio MAC Address
          </Button>
        )}
      </Grid>
      <Grid item>
        <Button color="primary" onClick={open}>
          Show Node Configuration
        </Button>
      </Grid>
      <TaskBasedConfigModal
        open={isOpen}
        modalTitle="Node Config"
        onClose={close}
        node={formState}
      />
    </Grid>
  );
}