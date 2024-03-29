import { ContainerInfo, NetworkInfo } from 'dockerode';

export default class ComposeServiceInfo {
  public readonly container: ContainerInfo;

  public readonly service: string;

  public readonly project: string;

  public readonly name: string;

  public readonly defaultNetwork?: NetworkInfo;

  constructor(container: ContainerInfo) {
    if (!('com.docker.compose.service' in container.Labels)) {
      throw new Error('Cannot create ComposeServiceInfo from a generic container');
    }

    this.container = container;
    this.service = container.Labels['com.docker.compose.service'];
    this.project = container.Labels['com.docker.compose.project'];
    this.name = container.Names[0].replace('/', '');
    this.defaultNetwork = container.NetworkSettings.Networks[container.HostConfig.NetworkMode] ?? undefined;

    if (!this.defaultNetwork) {
      this.defaultNetwork = Object
        .values(container.NetworkSettings.Networks)
        .find((el) => el.NetworkID === container.HostConfig.NetworkMode);
    }
  }
}
