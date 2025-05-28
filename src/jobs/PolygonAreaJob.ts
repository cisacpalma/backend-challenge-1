import { Feature, Polygon } from 'geojson';
import { Task } from "../models/Task";
import { Job } from "./Job";
import { area as calculateArea } from '@turf/area';
import { booleanValid } from '@turf/boolean-valid';


export class PolygonAreaJob implements Job {

    async run(task: Task): Promise<any> {
        console.log(`Running area analysis for task ${task.taskId}...`);

        const inputGeometry: Feature<Polygon> = JSON.parse(task.geoJson);

        if (!booleanValid(inputGeometry)) {
            throw new Error(`Invalid GeoJSON geometry for task ${task.taskId}. Please provide a valid polygon.`);
        }

        const area = calculateArea(inputGeometry);
        console.log(`Calculated area: ${area} square meters`);
        if (area <= 0) {
            throw new Error(`Invalid area calculated for task ${task.taskId}. Area must be greater than zero.`);
        }
        return area;
    }

}