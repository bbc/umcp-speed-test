
var new_seqs_count = 0;
var active_seqs = [];
var test_in_action = false;
var status_text = document.getElementById("status_text");
var active_seqs_count_text = document.getElementById("active_seqs_count_text");
active_seqs_count_text.innerText = active_seqs.length;

var timer = null;
var interval_ms = document.getElementById("interval_ms");
var confirmed_interval = parseFloat(interval_ms.value);
var interval_readout = document.getElementById("interval_readout");
var frequency_readout = document.getElementById("frequency_readout");
var last_pulse_time = null;
var next_pulse_time = null;
var measured_limit = 10;
var measured_intervals = [];
var measured_drifts = [];
var measured_index = 0;
var average_interval = document.getElementById("average_interval");
var average_pct = document.getElementById("average_pct");
var average_frequency = document.getElementById("average_frequency");
var max_drift = document.getElementById("max_drift");
var max_drift_pct = document.getElementById("max_drift_pct");

var stat_timer = null;
var requests_sent = 0;
var successful_responses = 0;
var failed_responses = 0;
var requests_status = document.getElementById("requests_status");
var requests_successful = document.getElementById("requests_successful");
var requests_failed = document.getElementById("requests_failed");
var awaiting_status = document.getElementById("awaiting_status");

update_slider_info();

status_text.innerText = "Creating UMCP Client Instance...";
var umcp = new umcplib('http://localhost:8090');

status_text.innerText = "Creating Composition...";
var comp = null
var date = new Date();

umcp.newComposition("Speed Test: " + ("00" + date.getDate().toString()).slice(-2) + "/" + ("00" + (date.getMonth()+1).toString()).slice(-2) + "/" + date.getFullYear().toString() + " " + ("00" + date.getHours().toString()).slice(-2) + ":" + ("00" + date.getMinutes().toString()).slice(-2) + ":" + ("00" + date.getSeconds().toString()).slice(-2)).then(function(c){
    window.comp = c;
    window.status_text.innerText = "Creating Composition... Done";
    
    window.status_text.innerText = "Creating Initial Sequence...";
    increase_sequences().then(function(){
        window.status_text.innerText = "Starting Timers...";
        window.last_pulse_time = window.performance.now();
        window.timer = window.setTimeout(function(){window.timer_pulse()}, window.confirmed_interval);
        window.next_pulse_time = window.last_pulse_time + window.confirmed_interval;
        window.stat_timer = window.setInterval(function(){window.update_stats()}, 250);
        window.status_text.innerText = "Running...";
    });
    
}).catch(function(e){
    window.status_text.innerText = "Creating Composition... FAILED!";
    throw e;
});

function activate_test(){
    test_in_action = true;
}

function deactivate_test(){
    test_in_action = false;
}

function update_slider_info(){
    interval_readout.innerText = interval_ms.value;
    frequency_readout.innerText = 1000/interval_ms.value;
}

function confirm_slider(){
    confirmed_interval = parseFloat(interval_ms.value);
    reset_stats();
}

function update_stats(){
    requests_status.innerText = requests_sent;
    requests_successful.innerText = successful_responses;
    requests_failed.innerText = failed_responses;
    awaiting_status.innerText = requests_sent - successful_responses - failed_responses;
    
    if(measured_intervals.length===0){
        max_drift.innerText = "--";
        max_drift_pct.innerText = "--";
        average_interval.innerText = "--";
        average_frequency.innerText = "--";
        average_pct.innerText = "--";
    } else {
        let max = Math.max.apply(Math, measured_drifts);
        let min = Math.min.apply(Math, measured_drifts);
        let drift = null;
        let drift_pct = null;
        if(Math.abs(max)>Math.abs(max)){
            drift = max;
            drift_pct = (max/confirmed_interval)*100;
        } else {
            drift = min;
            drift_pct = (min/confirmed_interval)*100;
        }
        if(drift>=0){
            max_drift.innerText = "+" + drift.toFixed(2);
            max_drift_pct.innerText = "+" + drift_pct.toFixed(2);
        } else {
            max_drift.innerText = drift.toFixed(2);
            max_drift_pct.innerText = drift_pct.toFixed(2);
        }
        let sum = measured_intervals.reduce(function(a, b) { return a + b; }, 0);
        let avg = sum/measured_intervals.length;
        let avg_pct = ((avg/confirmed_interval)*100)-100;
        average_interval.innerText = avg.toFixed(2);;
        average_frequency.innerText = (1000/avg).toFixed(2);;
        if(avg_pct>=0){
            average_pct.innerText = "+" + avg_pct.toFixed(2);
        } else {
            average_pct.innerText = avg_pct.toFixed(2);
        }
    }
    
    
    
  
}

function reset_stats(){
    // Ensure it does nothing if the timer hasn't even started yet.
    if(timer!==undefined){
        window.cancelTimer(timer);
        measured_intervals = [];
        measured_index = 0;
        last_pulse_time = window.performance.now();
        timer = window.setTimeout(timer_pulse, confirmed_interval);
        next_pulse_time = last_pulse_time + confirmed_interval;
    }
}


function timer_pulse(){
    let time_now = window.performance.now();
    measured_intervals[measured_index] = (time_now - last_pulse_time);
    measured_drifts[measured_index] = (time_now - next_pulse_time);
    measured_index++;
    if(measured_index >= measured_limit) measured_index = 0;
    last_pulse_time = time_now;
    next_pulse_time += confirmed_interval;
    timer = window.setTimeout(timer_pulse, next_pulse_time-window.performance.now());
    if(test_in_action) send_events();
}

function send_events(){
    for(seq_index in active_seqs){
        requests_sent++;
        active_seqs[seq_index].newEvent(Date.now()/1000).then(function(){
            window.successful_responses++;
        }).catch(function(e){
            window.failed_responses++;
            console.error("New event failed", e);
        })
    }
}

function increase_sequences(){
    status_text.innerText = "Creating Sequence...";
    return new Promise(function(resolve, reject){
        window.new_seqs_count++;
        window.comp.newSequence(String(window.new_seqs_count-1), "urn:x-ipstudio:format:event.composition.sequence.generic").then(function(s){
            window.active_seqs.push(s);
            window.active_seqs_count_text.innerText = window.active_seqs.length;
            window.status_text.innerText = "Creating Sequence... Done";
            resolve();
        }).catch(function(e){
            window.status_text.innerText = "Creating Sequence... FAILED!";
            reject(e);
        });
    });
}

function decrease_sequences(){
    if(active_seqs.length===0){ 
        status_text.innerText = "No active sequences remaining!";
    } else {
        status_text.innerText = "Deactivating Sequence...";
        active_seqs = active_seqs.splice(-1);
        active_seqs_count_text.innerText = active_seqs.length;
        status_text.innerText = "Deactivating Sequence... Done";
    }
}