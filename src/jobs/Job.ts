import { Task } from "../models/Task";


export interface Job {
    run(task: Task, params: any): Promise<any>;
}