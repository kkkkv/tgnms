#!/usr/bin/env python3
# Copyright 2004-present Facebook. All Rights Reserved.

""" Provide example to read topology from the API service.
"""

import sys

from module.topology_handler import TopologyHelper


print("This is an example to read topology from the api_service.")
topology_helper = TopologyHelper()
if not topology_helper:
    sys.exit("Cannot create TopologyHelper object")
topology_reply = topology_helper.get_topology_from_api_service()

if topology_reply:
    print(topology_reply.keys())
    print("Topology name is: '{}'".format(topology_reply["name"]))
    print("The topology config is: ", topology_reply["config"])
    print(
        "There are {} sites, {} nodes, {} links in the topology".format(
            len(topology_reply["sites"]),
            len(topology_reply["nodes"]),
            len(topology_reply["links"]),
        )
    )

print("Now, construct topology dictionary based on the reply")
network_config = topology_helper.obtain_network_dict(topology_reply)
print(
    "Function obtain_network_dict returns dictionary with keys of ",
    list(network_config.keys()),
)