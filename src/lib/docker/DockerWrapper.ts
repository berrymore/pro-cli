import Docker from 'dockerode';
import ComposeServiceInfo from './ComposeServiceInfo';

export default class DockerWrapper {
  public readonly driver: Docker;

  constructor(driver: Docker) {
    this.driver = driver;
  }

  async listServices(): Promise<Array<ComposeServiceInfo>> {
    return new Promise((resolve, reject) => {
      this.driver.listContainers((err, containers) => {
        if (err || !containers) {
          reject(err);
        } else {
          resolve(containers
            .filter((c) => 'com.docker.compose.service' in c.Labels)
            .map((c) => new ComposeServiceInfo(c)));
        }
      });
    });
  }
}
