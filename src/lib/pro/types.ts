export interface DockerConfigInterface {
  network: string;
}

export interface ConfigInterface {
  name: string;
  docker: DockerConfigInterface;
}

export interface RuntimeInterface {
  cwd: string;
  uid: number;
  gid: number;
  config?: ConfigInterface;
  nsRoot?: string;

  assertNamespace(): void;
}
