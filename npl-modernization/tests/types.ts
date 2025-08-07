// Common types
export interface BaseData {
    id: string;
    createdTime: number;
    additionalInfo?: string;
}

// Device types
export interface DeviceData extends BaseData {
    name: string;
    type: string;
    label?: string;
    tenantId: string;
    customerId?: string;
    deviceProfileId?: string;
    firmwareId?: string;
    softwareId?: string;
    deviceData?: any;
    credentials: any;
}

export interface DeviceAssignment {
    deviceId: string;
    customerId: string;
}

// Tenant types
export interface TenantData extends BaseData {
    title: string;
    name: string;
    region: string;
    country: string;
    state: string;
    city: string;
    address: string;
    address2: string;
    zip: string;
    phone: string;
    email: string;
    details?: any;
}

// Service interfaces
export interface NplEngineService {
    // Device operations
    createDevice(device: DeviceData): Promise<DeviceData>;
    updateDevice(device: DeviceData): Promise<DeviceData>;
    deleteDevice(deviceId: string): Promise<void>;
    getDevice(deviceId: string): Promise<DeviceData>;
    getAllDevices(): Promise<DeviceData[]>;
    assignDeviceToCustomer(assignment: DeviceAssignment): Promise<void>;
    unassignDeviceFromCustomer(deviceId: string): Promise<void>;

    // Tenant operations
    createTenant(tenant: TenantData): Promise<TenantData>;
    updateTenant(tenant: TenantData): Promise<TenantData>;
    deleteTenant(tenantId: string): Promise<void>;
    getTenant(tenantId: string): Promise<TenantData>;
    getAllTenants(): Promise<TenantData[]>;
}

export interface ThingsBoardService {
    // Device operations
    createDevice(device: DeviceData): Promise<DeviceData>;
    updateDevice(device: DeviceData): Promise<DeviceData>;
    deleteDevice(deviceId: string): Promise<void>;
    getDevice(deviceId: string): Promise<DeviceData>;
    getAllDevices(): Promise<DeviceData[]>;
    assignDeviceToCustomer(deviceId: string, customerId: string): Promise<void>;
    unassignDeviceFromCustomer(deviceId: string): Promise<void>;

    // Tenant operations
    createTenant(tenant: TenantData): Promise<TenantData>;
    updateTenant(tenant: TenantData): Promise<TenantData>;
    deleteTenant(tenantId: string): Promise<void>;
    getTenant(tenantId: string): Promise<TenantData>;
    getAllTenants(): Promise<TenantData[]>;
}