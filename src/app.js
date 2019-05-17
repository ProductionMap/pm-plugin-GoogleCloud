const compute = require('@google-cloud/compute');


function launchInstance(action) {
    return new Promise((resolve, reject) => {
        const gce = authenticate(action.params.PROJECT, action.params.CREDENTIALS);

        const zone = gce.zone(action.params.ZONE);

        const config = {
            os: action.params.OS,
        };
        if (action.params.IMAGE) {
            config.disks = {
                    initializeParams: {
                        boot: true,
                        sourceImage: action.params.IMAGE,
                    }
                }
        }
        if (action.params.NETWORK) {
            config.networkInterfaces = [
                {
                network: action.params.NETWORK,
                subnetwork: action.params.SUBNET,
                networkIP: action.params.NETIP
                }
            ]
        }

        if (action.params.MACHINE_TYPE) {
            config.machineType = action.params.MACHINE_TYPE;
        }

        zone.createVM(action.params.NAME, config, (err, vm, operation) => {
            // `operation` lets you check the status of long-running tasks.

            try {

                operation
                    .on('error', function (err) {
                        reject(err);
                    })
                    .on('running', function (metadata) {
                        console.log(metadata);
                    })
                    .on('complete', function (metadata) {
                        console.log("Virtual machine created!");
                        resolve(metadata);
                    });
            } catch (e) {
                reject(e);
            }
        });
    });

}

function authenticate(projectId, credentials) {
    return compute({
        projectId,
        credentials
    });
}

function deleteUpdateRestartInstance(action) {
    return new Promise((resolve, reject) => {
        const gce = authenticate(action.params.PROJECT, action.params.CREDENTIALS);

        let zone = gce.zone(action.params.ZONE);
        let name = action.params.NAME;
        const vm = zone.vm(name);


        switch (action.method.name) {
            case 'STOP_INSTANCE':
                return vm.stop();
            case 'DELETE_INSTANCE':
                return vm.delete();
            case 'RESET_INSTANCE':
                return vm.reset();
            default:
                throw new Error("Unknown method");
        }

    }).then(data => new Promise((resolve, reject) => {
        console.log(data[0]);
        resolve(data[1]);
    }));
}

function getExternalIP(action) {
    return new Promise((resolve, reject) => {
        const gce = authenticate(action.params.PROJECT, action.params.CREDENTIALS);

        let zone = gce.zone(action.params.ZONE);
        let name = action.params.NAME;
        const vm = zone.vm(name);

        vm.getMetadata().then((data) => {

            if ((((((data[0] || {}).networkInterfaces || [])[0] || {}).accessConfigs || [])[0] || {}).natIP) {
                resolve(data[0].networkInterfaces[0].accessConfigs[0].natIP);
            } else {
                reject('No external IP');
            }
        });
    });
}


function createNetwork(action) {
    return new Promise((resolve, reject) => {
        let Compute = new compute({
            projectId: action.params.PROJECT,
            keyFilename: action.params.KEYFILE,
        });
        let name = action.params.NAME;
        let network = Compute.network(name);
        let config = {
            autoCreateSubnetworks: false
        };
        function callback(err, network, operation, apiResponse) {
            if (err)
                return reject(err);
            resolve(apiResponse);
        }
        network.create(config, callback);
    })
}

function createSubnet(action) {
    return new Promise((resolve, reject) => {
        let Compute = new compute({
            projectId: action.params.PROJECT,
            keyFilename: action.params.KEYFILE,
        });
        let netID = action.params.NETID;
        let subName = action.params.SUBNAME;
        let network = Compute.network(netID);
        let config = {
            region: action.params.REGION,
            range: action.params.IPRANGE
        };
        function callback(err, network, operation, apiResponse) {
            if (err)
                return reject(err);
            resolve(apiResponse);
        }
        network.createSubnetwork(subName, config, callback);
    })
}

function reserveIp(action) {
    return new Promise((resolve, reject) => {
        const Compute = new compute({
            projectId: action.params.PROJECT,
            keyFilename: action.params.KEYFILE,
        });
        let resName = action.params.RESNAME;
        let region = Compute.region(action.params.REGION);
        let config = {
            subnetwork: 'regions/' + action.params.REGION + '/subnetworks/' + action.params.SUBNAME,
            addressType: 'INTERNAL',
            address: action.params.RESIP
        };
        function callback(err, network, operation, apiResponse) {
            if (err)
                return reject(err);
            resolve(apiResponse);
        }
        region.createAddress(resName, config, callback);

    })
}

module.exports = {
    LAUNCH_INSTANCE: launchInstance,
    STOP_INSTANCE: deleteUpdateRestartInstance,
    DELETE_INSTANCE: deleteUpdateRestartInstance,
    RESTART_INSTANCE: deleteUpdateRestartInstance,
    GET_INSTANCE_EXTERNAL_IP: getExternalIP,
    createNetwork: createNetwork,
    createSubnet: createSubnet,
    reserveIp: reserveIp
};


