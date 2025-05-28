import * as fs from 'fs';
import * as yaml from 'js-yaml';
import { DataSource } from 'typeorm';
import { Workflow } from '../models/Workflow';
import { Task } from '../models/Task';
import { TaskStatus } from "../workers/taskRunner";

export enum WorkflowStatus {
    Initial = 'initial',
    InProgress = 'in_progress',
    Completed = 'completed',
    Failed = 'failed'
}

interface WorkflowStep {
    taskType: string;
    stepNumber: number;
    dependsOn?: string | null;
}

interface WorkflowDefinition {
    name: string;
    steps: WorkflowStep[];
}

export class BadWorkflowDefinitionError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'BadWorkflowDefinitionError';
    }
}

export class WorkflowFactory {
    constructor(private dataSource: DataSource) { }

    private detectCycle(initialTaskType: string, dependecyMap: Map<string, string>, visited: string[]): boolean {
        if (visited.includes(initialTaskType)) {
            return true; // Cycle detected
        }
        visited.push(initialTaskType);
        const dependsOn = dependecyMap.get(initialTaskType);
        if (dependsOn) {
            if (visited.includes(dependsOn)) {
                return true; // Cycle detected
            }
            return this.detectCycle(dependsOn, dependecyMap, visited);
        } else {
            return false;
        }
    }

    /**
     * Creates a workflow by reading a YAML file and constructing the Workflow and Task entities.
     * @param filePath - Path to the YAML file.
     * @param clientId - Client identifier for the workflow.
     * @param geoJson - The geoJson data string for tasks (customize as needed).
     * @returns A promise that resolves to the created Workflow.
     */
    async createWorkflowFromYAML(filePath: string, clientId: string, geoJson: string): Promise<Workflow> {
        const fileContent = fs.readFileSync(filePath, 'utf8');
        const workflowDef = yaml.load(fileContent) as WorkflowDefinition;

        const cycleDetection = new Map<string, string>();

        workflowDef.steps.forEach(step => {
            if (step.dependsOn) {
                cycleDetection.set(step.taskType, step.dependsOn);
            }
        });

        const hasCycle = workflowDef.steps.filter(step => step.dependsOn).some(step => this.detectCycle(step.taskType, cycleDetection, []));

        if (hasCycle) {
            throw new BadWorkflowDefinitionError('Workflow definition contains a cycle in task dependencies.');
        }

        const workflowRepository = this.dataSource.getRepository(Workflow);
        const taskRepository = this.dataSource.getRepository(Task);
        const workflow = new Workflow();

        workflow.clientId = clientId;
        workflow.status = WorkflowStatus.Initial;

        const savedWorkflow = await workflowRepository.save(workflow);

        let tasks: Task[] = workflowDef.steps.map(step => {
            const task = new Task();
            task.clientId = clientId;
            task.geoJson = geoJson;
            task.status = TaskStatus.Queued;
            task.taskType = step.taskType;
            task.stepNumber = step.stepNumber;
            task.dependsOn = step.dependsOn || null;
            task.workflow = savedWorkflow;
            return task;
        });

        // Sort tasks based on dependencies and step numbers
        tasks.sort((a, b) => {
            if (a.dependsOn === b.taskType) {
                return 1;
            } else if (b.dependsOn === a.taskType) {
                return -1;
            } else {
                return a.stepNumber - b.stepNumber;
            }
        });

        tasks = tasks.map((task, index) => {
            task.stepNumber = index + 1;
            return task;
        });

        await taskRepository.save(tasks);

        return savedWorkflow;
    }
}