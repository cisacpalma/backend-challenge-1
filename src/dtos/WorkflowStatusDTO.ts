export interface WorkflowStatusDTO {
    workflowId: string;
    status: string;
    completedTasks: number;
    totalTasks: number;
}