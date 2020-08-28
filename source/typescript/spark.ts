import { addModuleToCFW } from "@candlefw/cfw";

/**
 * Used to call the Scheduler after a JavaScript runtime tick.
 *
 * Depending on the platform, caller will either map to requestAnimationFrame or it will be a setTimout.
 */
const caller = (typeof (window) == "object" && window.requestAnimationFrame) ? window.requestAnimationFrame : f => {
    setTimeout(f, 5);
};

const perf = (typeof (performance) == "undefined") ? { now: () => Date.now() } : performance;
/**
 * Interface used by objects that are have an
 * update scheduled by Spark
 */
interface Sparky {

    /**
     * Called when the scheduling requirements of the
     * the Sparky object is met.
     * @param step_ratio 
     * @param diff 
     */
    scheduledUpdate(step_ratio: number, diff: number);
    /**
     * Used internally by Spark. Stores scheduling information.
     * 
     * Spark will create this property on a Sparky object if it is 
     * not already present.
     * 
     * @private
     */
    _SCHD_?: number;
}


/**
 * Handles updating objects. It does this by splitting up update cycles, to respect the browser event model. 
 *    
 * If any object is scheduled to be updated, it will be blocked from scheduling more updates until the next ES VM tick.
 */
class Spark {
    update_queue_a: Sparky[];
    update_queue_b: Sparky[];
    update_queue: Sparky[];;
    queue_switch: number;
    frame_time: number;
    SCHEDULE_PENDING: boolean;
    callback: () => void;

    constructor() {

        this.update_queue_a = [];
        this.update_queue_b = [];
        this.update_queue = this.update_queue_a;
        this.queue_switch = 0;
        this.callback = this.update.bind(this);

        if (typeof (window) !== "undefined") {
            window.addEventListener("load", () => {
                caller(this.callback);
            });
        } else {
            this.callback = this.update.bind(this);
            caller(this.callback);
        }

        this.frame_time = perf.now();

        this.SCHEDULE_PENDING = false;
    }

    /**
     * Given an object that has a _SCHD_ Boolean property, the Scheduler will queue the object and call its .scheduledUpdate function
     * the following tick. If the object does not have a _SCHD_ property, the Scheduler will persuade the object to have such a property.
     */
    /**
     * 
     * @param object 
     * @param time_start 
     * @param time_end - Tha m 
     */
    queueUpdate(object: Sparky, time_start: number = 1, time_end: number = 0) {

        if (object._SCHD_ || object._SCHD_ > 0) {
            if (this.SCHEDULE_PENDING)
                return;
            else
                return caller(this.callback);
        }

        object._SCHD_ = ((time_start & 0xFFFF) | ((time_end) << 16));

        this.update_queue.push(object);

        this.frame_time = perf.now() | 0;

        if (!this.SCHEDULE_PENDING) {
            this.SCHEDULE_PENDING = true;
            caller(this.callback);
        }
    }

    removeFromQueue(object) {

        if (object._SCHD_)
            for (let i = 0, l = this.update_queue.length; i < l; i++)
                if (this.update_queue[i] === object) {
                    this.update_queue.splice(i, 1);
                    object._SCHD_ = 0;

                    if (l == 1)
                        this.SCHEDULE_PENDING = false;

                    return;
                }
    }

    /**
     * Called by the caller function every tick. Calls .update on any object queued for an update. 
     */
    update() {
        this.SCHEDULE_PENDING = false;

        const
            uq = this.update_queue,
            time = perf.now() | 0,
            diff = Math.ceil(time - this.frame_time) | 1,
            step_ratio = (diff * 0.06); //  step_ratio of 1 = 16.66666666 or 1000 / 60 for 60 FPS



        this.frame_time = time;

        if (this.queue_switch == 0)
            (this.update_queue = this.update_queue_b, this.queue_switch = 1);
        else
            (this.update_queue = this.update_queue_a, this.queue_switch = 0);

        for (let i = 0, l = uq.length, o = uq[0]; i < l; o = uq[++i]) {
            let timestart = ((o._SCHD_ & 0xFFFF)) - diff;
            let timeend = ((o._SCHD_ >> 16) & 0xFFFF);

            o._SCHD_ = 0;

            if (timestart > 0) {
                this.queueUpdate(o, timestart, timeend);
                continue;
            }

            timestart = 0;

            if (timeend > 0)
                this.queueUpdate(o, timestart, timeend - diff);

            /** 
                To ensure one code path doesn't block any others with an exception, 
                scheduledUpdate methods are called within a try catch block. 
                Errors by default are printed to console. 
            **/
            try {
                o.scheduledUpdate(step_ratio, diff);
            } catch (e) {
                this.handleError(e);
            }
        }

        uq.length = 0;
    }
    /**
     * Override this method to handle errors 
     * encountered when calling Sparky.queueUpdate.
     * 
     * Default action logs the error to console.
     * 
     * @param e - error object
     */
    handleError(e: any) { console.log(e); }

    async sleep(timeout = 1) {
        return new Promise(res => {
            this.queueUpdate({
                scheduledUpdate: () => res()
            }, timeout);
        });
    }
}

const spark = new Spark();

export { Spark as SparkConstructor, Sparky };

addModuleToCFW(spark, "spark");
export default spark;
