import Dockerode, { ContainerInfo } from 'dockerode';
import { WrappedDocker, ComposeServiceInfo } from './types';

function createDockerode(): Dockerode {
  return new Dockerode();
}

function createComposeServiceInfo(container: ContainerInfo): ComposeServiceInfo {
  const networkEntry = Object
    .entries(container.NetworkSettings.Networks)
    .find(([name, network]) => {
      const networkMode = container.HostConfig.NetworkMode;

      return networkMode === name || networkMode === network.NetworkID;
    });

  return {
    container,
    service: container.Labels['com.docker.compose.service'],
    project: container.Labels['com.docker.compose.project'],
    containerName: container.Names[0].replace('/', ''),
    network: networkEntry ? networkEntry[1] : undefined,
  };
}

export function createDocker(): WrappedDocker {
  const driver: Dockerode = createDockerode();

  return {
    driver,
    async listComposeServices(): Promise<ComposeServiceInfo[]> {
      const containers = await this.driver.listContainers(
        { filters: '{"label": ["com.docker.compose.service"]}' },
      );

      return containers.map((c) => createComposeServiceInfo(c));
    },
  };
}
