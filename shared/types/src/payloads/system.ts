import { BackendType, SystemStatusLevel } from '../enums';

export interface SystemStatus {
  backend: BackendType;
  status: SystemStatusLevel;
  version: string;
}