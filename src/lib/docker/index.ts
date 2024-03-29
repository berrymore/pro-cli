import Docker from 'dockerode';
import DockerWrapper from './DockerWrapper';

export function createDocker(): DockerWrapper {
  return new DockerWrapper(new Docker());
}
