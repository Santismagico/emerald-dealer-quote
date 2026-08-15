export interface CloudOperationScope {
  userId: string;
  organizationId: string;
}

let activeScope: CloudOperationScope | null = null;

/**
 * La identidad activa se publica solo después de resolver la membresía real.
 * Al cambiar o cerrar sesión se borra primero, para que la cola falle cerrada.
 */
export function setActiveCloudScope(scope: CloudOperationScope | null): void {
  activeScope = scope?.userId && scope.organizationId ? { ...scope } : null;
}

export function getActiveCloudScope(): CloudOperationScope | null {
  return activeScope ? { ...activeScope } : null;
}
