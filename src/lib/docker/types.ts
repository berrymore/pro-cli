import Dockerode, { ContainerInfo, NetworkInfo } from 'dockerode';

export interface ComposeServiceInfo {
  container: ContainerInfo;
  service: string;
  project: string;
  containerName: string;
  network?: NetworkInfo;
}

export interface WrappedDocker {
  driver: Dockerode;

  listComposeServices(): Promise<ComposeServiceInfo[]>;
}
