
//global variables
let reportID;
let eventID;
let db;

//---------------------Start up--------------------------
// Open (or create) the database

const request = indexedDB.open("ShiftReportDB", 1);
populateAllSelectsFromLookupDB()

request.onupgradeneeded = function(event) {
  db = event.target.result;
  
//check to see that table doesn't already exist before creating it
if (!db.objectStoreNames.contains("reports")) {
    db.createObjectStore("reports", { keyPath: "reportID"}); // Write the primary key "reportID" used to identify individual reports
  }

// Create events store with eventID key and index on reportID

  if (!db.objectStoreNames.contains("events")) {
    const eventsStore = db.createObjectStore("events", { keyPath: "eventID"}); //add a unique eventID for each event record
    //Create an index to link events.reportID to reports.reportID (foreign key)
    eventsStore.createIndex("reportIDIndex", "reportID", { unique: false });
  }

}; //onupgradeneeded

request.onsuccess = function(event) {
  db = event.target.result;
  console.log("Database ready");
setShiftDetailsInitialState(); //if there are records in the "reports" table, collapse the detail, otherwise expand 
};

request.onerror = function(event) {
  console.error("Database error:", event.target.error);
  
};

//----------------------Set intial state of the page formatting------------------------
// sets the starting format based on whether there are existing records (report not submitted) or not in the "reports" table
function setShiftDetailsInitialState() {
  const transaction = db.transaction(["reports"], "readonly");
  const store = transaction.objectStore("reports");
  const countRequest = store.count();

  countRequest.onsuccess = function() {
    const hasRecords = countRequest.result > 0;
    const shiftDetailsDiv = document.getElementById("shiftDetails");
    const heading = document.getElementById("reportHeading");

    if (hasRecords) {
      shiftDetailsDiv.open= false; // Collapse if records exist
    
      const getLastRecord = store.openCursor(null, "prev");
      getLastRecord.onsuccess = function(event) {
        const cursor = event.target.result;
        if (cursor) {
          const report = cursor.value;     
          reportID = report.reportID    
          const headingText = `Report for ${report.date} ${report.shift} ${report.shiftletter} - ${Array.isArray(report.users) ? report.users.join(", ") : report.users}`;
          heading.textContent = headingText;
          handover.textContent = report.handover
	  nextShift.textContent = report.nextShift
         loadEvents(reportID);
      
        }
      };




    } else {
      shiftDetailsDiv.open = true; // Expand if no records
      heading.textContent = "Enter Shift Details to Continue";
    }
  };

  countRequest.onerror = function() {
    console.error("Failed to count reports.");
  };
}



// ----------------Save button /Create shift Function----------------------
document.getElementById("saveBtn").addEventListener("click", function() {


  //does a report already exist in the DB? only 1 is allowed!
let transaction = db.transaction(["reports"], "readonly");
let store = transaction.objectStore("reports");
let countRequest = store.count();

  countRequest.onsuccess = function() {
    const hasRecords = countRequest.result > 0;
    if (hasRecords) {
      //report record already exists! exit the code and alert the user!
      alert("A shift report already exists! To create a new report, you must delete data to start a new one!");
      document.getElementById("shiftDetails").open=false;
      return;
    };



  //OnDate
  const onDate = document.getElementById("ondateInput").value;
  console.log("Selected date:", onDate);

 //TSAs userList
  const userList = document.getElementById("select-Users");
  const selectedTSAs = [];  //make new array


 for (let option of userList.options) {  //let option = number of options in the select box
  if (option.selected) {
    selectedTSAs.push({
      id: option.value,
      name: option.getAttribute("data-display-fields")
    });
  }
}          
         // if the option is selected,
         //push ("add") it to the array
      
    }                                 //else, next option
  }                                   // for each option

   //shiftList
  const shiftLetter = document.getElementById("shiftLetterList").value;
  //days/nights
  const shift= document.getElementById("shiftList").value;


console.log("Selected TSAs:", selectedTSAs);

//Error Checking
if(!onDate){
  alert("Please select a date for the report!");
   return; //exit function
}
if(selectedTSAs.length===0){
  alert("Please select a User!");
  return; //exit function
}

if(!shiftLetter){
  alert("choose a shift letter");
  return;
}

if(!shift){
  alert("pick days or nights");
  return;
}

//create unique reportID for this report
reportID = generateGUID()

//Prepare the Record
const record = {
  reportID: reportID,
  date: onDate,
  users: selectedTSAs,
  shiftletter: shiftLetter,
  shift: shift
};

//Write record to the DB

transaction = db.transaction(["reports"], "readwrite");
store = transaction.objectStore("reports");
countRequest = store.count();

//declared higher up in this function
    //const transaction = db.transaction(["reports"], "readwrite");
    //const store = transaction.objectStore("reports");

//write the new shift report record, listen for the onsuccess and get the value of the reportID
const request = store.add(record);

request.onsuccess = function(event) {

  console.log("Record Saved:", record, "with reportID:", reportID);
  alert("Record added: " + JSON.stringify(record));

   setShiftDetailsInitialState(); //set the format for the page, now with the new record added

};
  
};

});
// End of Save Button Function


//-------------------------Add an event--------------------------------------------
document.getElementById("startEventBtn").addEventListener("click", function () {

  // Check a report exists before proceeding
  const transaction = db.transaction(["reports"], "readonly");
  const store = transaction.objectStore("reports");
  const countRequest = store.count();

  countRequest.onsuccess = function () {
    const hasRecords = countRequest.result > 0;

    if (!hasRecords) {
      alert("Error: You must first create a shift report to add events.");
      return;
    }

    // Only proceed if report exists
    const eventTitle = document.getElementById("eventTitleInput").value.trim();
    const eventLocation = document.getElementById("locationInput").value.trim();

    if (eventTitle === "") {
      alert("Event title cannot be empty.");
      return;
    }

    const startTime = new Date().toISOString(); // UTC time
    const eventID = generateGUID();

    const eventRecord = {
      eventID: eventID,
      reportID: reportID,  // Assuming global variable
      startTime: startTime,
      endTime: null,
      title: eventTitle,
      location: eventLocation
    };

    const eventTransaction = db.transaction(["events"], "readwrite");
    const eventStore = eventTransaction.objectStore("events");
    const request = eventStore.add(eventRecord);

    request.onsuccess = function () {
      console.log("Event started:", eventRecord);
      alert(`Event: ${eventTitle} started`);
      loadEvents(reportID);

      // Clear inputs
      document.getElementById("eventTitleInput").value = "";
      document.getElementById("locationInput").value = "";

      // Collapse the createEvent summary
      document.getElementById("createEvent").open = false;
    };

    request.onerror = function (event) {
      console.error("Error starting event:", event.target.error);
      alert("Failed to start event.");
    };
  };

  countRequest.onerror = function (event) {
    console.error("Error checking reports:", event.target.error);
    alert("Failed to check reports.");
  };
});


//----------------------------Populate the Event log table------------------
// Function to load all events from IndexedDB and display them in the table
function loadEvents(reportId) {
  // Clear existing table rows
  const tbody = document.querySelector("#eventTable tbody");
  tbody.innerHTML = "";

  // Open transaction and get all events with matching reportId
  const transaction = db.transaction("events", "readonly");
  const store = transaction.objectStore("events");
  const index = store.index("reportIDIndex");  // Assuming you have a reportId index

  const request = index.getAll(IDBKeyRange.only(reportId));

  request.onsuccess = (event) => {
    const events = event.target.result;

    if (!events.length) {
      // No events found for this report
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = 5; // total columns
      td.textContent = "No events found";
      tr.appendChild(td);
      tbody.appendChild(tr);
      return;
    }

  // Sort events by startTime descending (latest first)
  events.sort((a, b) => {
    return new Date(b.startTime) - new Date(a.startTime);
  });
    // Create a row for each event
    events.forEach(ev => {
      const tr = document.createElement("tr");

      // Format dates nicely, or show "N/A"
      const startTime = ev.startTime ? new Date(ev.startTime).toLocaleTimeString() : "N/A";
      const endTime = ev.endTime ? new Date(ev.endTime).toLocaleTimeString() : "N/A";

      // Add columns
      tr.innerHTML = `
        <td>${startTime}</td>
        <td>${endTime}</td>
        <td>${ev.location || ""}</td>
        <td>${ev.title || ""}</td>
        <td><button class="editBtn" data-id="${ev.eventID}">Edit</button></td>
      `;

      tbody.appendChild(tr);
    });

    // Add event listeners to Edit buttons
    document.querySelectorAll(".editBtn").forEach(button => {
      button.addEventListener("click", () => {
        eventID = button.getAttribute("data-id"); //eventId taken from the button.
        openEventEditor();
      });
    });
  };

  request.onerror = (e) => {
    console.error("Error loading events:", e);
  };
}



//---------------------------------Event edit button on click------------------
// ----open event editor function---
function openEventEditor() {
  console.log("Open editor for event ID:", eventID);
// Expand the event details <details> block
  const detailsBlock = document.getElementById("eventDetails");
  detailsBlock.open = true;

  // Store the eventID globally for later save
  //editingEventID = Number(eventId);

  // If start or end time is empty, on focus / open of the date time picker, set the default time to now (local)
document.getElementById("editStartTime").addEventListener("focus", function() {
  if (!this.value) {
    this.value = getNowLocalDateTime();
  }
});
document.getElementById("editEndTime").addEventListener("focus", function() {
  if (!this.value) {
    this.value = getNowLocalDateTime();
  }
});

  // Fetch the event record from IndexedDB
  const transaction = db.transaction(["events"], "readonly");
  const store = transaction.objectStore("events");
  const request = store.get(eventID);

  request.onsuccess = function(event) {
    const record = event.target.result;

    if (record) {
      // Populate the fields
      document.getElementById("editTitle").value=record.title ? record.title : "";
      document.getElementById("editLocation").value=record.location ? record.location : "";
      document.getElementById("editStartTime").value =record.startTime ? UTCToLocalDateTime(record.startTime) : ""; 
      document.getElementById("editEndTime").value = record.endTime ? UTCToLocalDateTime(record.endTime) : "";
      document.getElementById("editComment").value=record.comment ? record.comment : "";

      // Clear all selections
      const tasksSelect = document.getElementById("editTasks");
      for (let option of tasksSelect.options) {
        option.selected = false;
      }

      // Select tasks based on stored record.tasks
      if (Array.isArray(record.tasks)) {
        for (let option of tasksSelect.options) {
          if (record.tasks.includes(option.value)) {
            option.selected = true;
          }
        }
      }

    } else {
      alert("Event not found.");
    }
  };

  request.onerror = function(event) {
    console.error("Error fetching event:", event.target.error);
    alert("Failed to load event details.");
  };
}


//-----save event on click----------
document.getElementById("saveEventBtn").addEventListener("click", function () {

  //const eventId = eventID //parseInt(document.getElementById("editEventID").value);  // Hidden input for eventID
  const updatedTitle = document.getElementById("editTitle").value.trim();
  const updatedLocation = document.getElementById("editLocation").value.trim();
  const updatedStartTime = document.getElementById("editStartTime").value;
  const updatedEndTime = document.getElementById("editEndTime").value;
  const updatedComment = document.getElementById("editComment").value.trim();

  const taskList = document.getElementById("editTasks");


  //Check Times are picked

  const compareStart = new Date(updatedStartTime)
  const compareEnd = new Date(updatedEndTime)

    if(isNaN(compareStart)){
     alert("Must pick a valid StartTime");
     return;
  }
   if(isNaN(compareEnd)){
     alert("Must pick a valid EndTime");
     return;
  }



   //Check end vs start

  if(compareEnd < compareStart){
   alert("Error: End time must be later or equal to start time");
   return;
 }


  const selectedTasks = [];  //make new array

  for(let option of taskList.options){ //let option = number of options in the select box
    if (option.selected) {             // if the option is selected,
      selectedTasks.push(option.value); //push ("add") it to the array
    }                                 //else, next option
  }                                   // for each option


  if (!(eventID)) {
    alert("Invalid event ID. Cannot save changes.");
    return;
  }

  const transaction = db.transaction(["events"], "readwrite");
  const store = transaction.objectStore("events");

  const getRequest = store.get(eventID);

  getRequest.onsuccess = function (event) {
    const existingRecord = event.target.result;

    if (!existingRecord) {
      alert("Event not found in database.");
      return;
    }

    // Update the fields
    existingRecord.title = updatedTitle;
    existingRecord.location = updatedLocation;
    existingRecord.startTime = updatedStartTime ? new Date(updatedStartTime).toISOString() : null;
    existingRecord.endTime = updatedEndTime ? new Date(updatedEndTime).toISOString() : null;
    existingRecord.tasks= selectedTasks;
    existingRecord.comment= updatedComment;
    

    const updateRequest = store.put(existingRecord);

    updateRequest.onsuccess = function () {
      alert("Event updated successfully.");
      loadEvents(existingRecord.reportID);  // Refresh event table
      // Optionally hide editor here
      const eventDetails = document.getElementById("eventDetails");
      eventDetails.open = false // Collapse

    };

    updateRequest.onerror = function (e) {
      console.error("Error updating event:", e.target.error);
      alert("Failed to update event.");
    };
  };

  getRequest.onerror = function (e) {
    console.error("Error fetching event:", e.target.error);
    alert("Error retrieving event for editing.");
  };

  eventID=null; //clear the eventID to prevent shenanigans
});

//---------------------------------Cancel event edit button on click------------------
document.getElementById("cancelEditBtn").addEventListener("click", () => {

// 1. Collapse the details panel
  const eventDetails = document.getElementById("eventDetails");
  eventDetails.open = false;

  // 2. Clear each control's value
  document.getElementById("editStartTime").value = "";
  document.getElementById("editEndTime").value = "";
  document.getElementById("editLocation").value = "";
  document.getElementById("editTitle").value = "";
 

  // 3. Reset the tasks multi-select
  const tasksSelect = document.getElementById("editTasks");
  for (let option of tasksSelect.options) {
    option.selected = false;
  }

  // 4. Clear the editing flag
  eventID=null; //clear the eventID to prevent shenanigans

});

//-----------------Save Hand-over Notes--------------------

document.getElementById("saveHandoverBtn").addEventListener("click", () => {

 const transaction = db.transaction(["reports"], "readwrite");
  const store = transaction.objectStore("reports");

  const getRequest = store.get(reportID);

  getRequest.onsuccess = function (event) {
    const existingRecord = event.target.result;

    if (!existingRecord) {
      alert("Report not found in database.");
      return;
    }

    // Update the fields
    existingRecord.handover = document.getElementById("handover").value.trim();
 

    const updateRequest = store.put(existingRecord);

    updateRequest.onsuccess = function () {
      alert("Handover updated successfully.");
     

    };

    updateRequest.onerror = function (e) {
      console.error("Error updating handover:", e.target.error);
      alert("Failed to update event.");
    };
  };

  getRequest.onerror = function (e) {
    console.error("Error fetching handover:", e.target.error);
    alert("Error retrieving event for editing.");
  };

});

//-----------------Save Anticipated Work--------------------

document.getElementById("saveNextShiftBtn").addEventListener("click", () => {

 const transaction = db.transaction(["reports"], "readwrite");
  const store = transaction.objectStore("reports");

  const getRequest = store.get(reportID);

  getRequest.onsuccess = function (event) {
    const existingRecord = event.target.result;

    if (!existingRecord) {
      alert("Report not found in database.");
      return;
    }

    // Update the fields
    existingRecord.nextShift = document.getElementById("nextShift").value.trim();
 

    const updateRequest = store.put(existingRecord);

    updateRequest.onsuccess = function () {
      alert("Next Shift Info updated successfully.");
     

    };

    updateRequest.onerror = function (e) {
      console.error("Error updating nextShift:", e.target.error);
      alert("Failed to update event.");
    };
  };

  getRequest.onerror = function (e) {
    console.error("Error fetching  nextShift:", e.target.error);
    alert("Error retrieving event for editing.");
  };

});

// ----------exportToJSON-----------------------------------------

document.getElementById("exportJSONBtn").addEventListener("click", function() {
  const data = { reports: [], events: [] };
  const reportsTransaction = db.transaction(["reports"], "readonly");
  const reportsStore = reportsTransaction.objectStore("reports");
  const reportsRequest = reportsStore.getAll();

  reportsRequest.onsuccess = function() {
    data.reports = reportsRequest.result;

    const eventsTransaction = db.transaction(["events"], "readonly");
    const eventsStore = eventsTransaction.objectStore("events");
    const eventsRequest = eventsStore.getAll();

    eventsRequest.onsuccess = function() {
      data.events = eventsRequest.result;

      const jsonStr = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = url;

      // Generate timestamp for filename
      const now = new Date();
      const timestamp = now.getFullYear().toString() +
        String(now.getMonth() + 1).padStart(2, '0') +
        String(now.getDate()).padStart(2, '0') + '_' +
        String(now.getHours()).padStart(2, '0') +
        String(now.getMinutes()).padStart(2, '0') +
        String(now.getSeconds()).padStart(2, '0');

      link.download = `ShiftReport_${timestamp}.json`;

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    };
  };
});






//------------------- Delete Data----------------------------------------------------

document.getElementById("deleteDataBtn").addEventListener("click", clearAllData);

function clearAllData() {
  if (!db) {
    alert("Database not initialized yet.");
    return;
  }

const confirmDelete=confirm("This will delete this shift report. Ensure you have saved the JSON file first! Continue?");

if(!confirmDelete){
	return; //cancelled by user
}

  const transaction = db.transaction(["reports", "events"], "readwrite");

  const reportsStore = transaction.objectStore("reports");
  const eventsStore = transaction.objectStore("events");

  const reportsClearRequest = reportsStore.clear();
  const eventsClearRequest = eventsStore.clear();

  reportsClearRequest.onsuccess = () => {
    console.log("Reports table cleared.");
  };

  eventsClearRequest.onsuccess = () => {
    console.log("events table cleared.");
  };

  transaction.oncomplete = () => {
    alert("All records cleared.");
    // Optionally update UI, e.g. clear selectors
 setShiftDetailsInitialState() 
  };

  transaction.onerror = (event) => {
    console.error("Error clearing data:", event.target.error);
    alert("Failed to clear records.");
  };


}

//------------------END Delete Data-------------------------------------------------------


//-----------------Get Lookup Data--------------------------------
 document.getElementById("updateLibraryBtn").addEventListener("click", () => {
  // Create a hidden file input dynamically
  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = ".json";
  fileInput.style.display = "none";

  fileInput.onchange = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
      console.log("Reading lookup JSON file...");
      const text = await file.text();
      const lookupJson = JSON.parse(text);

      console.log("Deleting old Lookups DB...");
      await deleteDB("LookupsDB");

      console.log("Importing new lookups...");
      await importLookupsFromJson("LookupsDB", lookupJson);

      console.log("Lookups import complete!");
      alert("Lookup library updated successfully.");
      await populateAllSelectsFromLookupDB(); // <-- trigger select option population

    } catch (err) {
      console.error("Error updating lookup library:", err);
      alert("Failed to update lookup library: " + err.message);
    }
  };

  // Trigger file picker dialog
  document.body.appendChild(fileInput);
  fileInput.click();
  document.body.removeChild(fileInput);
});

function deleteDB(dbName) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(dbName);
    request.onsuccess = () => resolve();
    request.onerror = (e) => reject(e.target.error);
    request.onblocked = () => console.warn("Delete blocked; close other tabs.");
  });
}

function importLookupsFromJson(dbName, lookupJson) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, 1);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // Create one object store per table using its defined primary key
      Object.entries(lookupJson).forEach(([storeName, storeData]) => {
        const keyPath = storeData.primaryKey || undefined;
        db.createObjectStore(storeName, keyPath ? { keyPath } : { autoIncrement: true });
        console.log(`Created object store: ${storeName} (keyPath: ${keyPath || "autoIncrement"})`);
      });
    };

    request.onsuccess = (event) => {
      const db = event.target.result;
      const tx = db.transaction(Object.keys(lookupJson), "readwrite");

      Object.entries(lookupJson).forEach(([storeName, storeData]) => {
        const records = storeData.records || [];
        const store = tx.objectStore(storeName);
        records.forEach(record => store.put(record));
      });

      tx.oncomplete = () => {
        db.close();
        resolve();
      };

      tx.onerror = (e) => reject(e.target.error);
    };

    request.onerror = (e) => reject(e.target.error);
  });
}

//----------------POPULATE SELECTS BASED ON NAME CONVENTION--------------

//the naming convention is:

//id="select-[tableName]"
//data-value-field="PrimaryKeyField"
//data-display-fields="GivenName,Surname" (or whatever fields make sense)
//data-sort="true" (optional)

// <select
//  id="select-persons"
//  data-value-field="PERSONID"
//  data-display-fields="Given Name,Surname"
//  data-sort="true">
//</select>

async function populateAllSelectsFromLookupDB() {
  const dbName = "LookupsDB";
  const request = indexedDB.open(dbName, 1);

  request.onsuccess = async (event) => {
    const db = event.target.result;

    // Find all <select> elements with id starting with 'select-'
    const selects = document.querySelectorAll('select[id^="select-"]');

    for (const select of selects) {
      const idParts = select.id.split("-");
      const tableName = idParts[1];

      const valueField = select.dataset.valueField;
      const displayFields = select.dataset.displayFields
        ? select.dataset.displayFields.split(",").map(f => f.trim())
        : [];
      const shouldSort = select.dataset.sort === "true";

      if (!valueField) {
        console.warn(`Select ${select.id} is missing data-value-field.`);
        continue;
      }

      try {
       
const tx = db.transaction([tableName], "readonly");
const store = tx.objectStore(tableName);
const allRecords = await getAllRecords(store);

let options = allRecords.map(record => {
  const value = record[valueField];
  let label = displayFields.length > 0
    ? displayFields.map(field => record[field] ?? "").join(" ").trim()
    : value;
  return { value, label };
});

        if (shouldSort) {
          options.sort((a, b) => a.label.localeCompare(b.label));
        }

        // Clear existing options and populate
        select.innerHTML = "";
        for (const opt of options) {
          const option = document.createElement("option");
          option.value = opt.value;
          option.textContent = opt.label;
          select.appendChild(option);
        }

      } catch (err) {
        console.error(`Error populating select from '${tableName}':`, err);
      }
    }

    db.close();
  };

  request.onerror = (e) => {
    console.error("Failed to open IndexedDB:", e.target.error);
  };
}


function getAllRecords(store) {
  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}


//----------------CREATE A GUID------------------------------
//guid is used to create unique record identifiers, will facilitate live updating to SQL 
//without having to be online and fetch the ID for the record from SQL.

function generateGUID() {
  return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
    (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
  );
}


//------------DEALING WIH THE DREADED DATE-TIME----------------

// Convert local datetime string (from <input type="datetime-local">) to UTC ISO string for storage
function localDateTimeToUTC(localDateTimeStr) {
  if (!localDateTimeStr) return null;
  // localDateTimeStr format: "YYYY-MM-DDTHH:mm" (e.g., "2025-06-25T14:30")
  const localDate = new Date(localDateTimeStr);
  return localDate.toISOString(); // UTC ISO format
}

// Convert UTC ISO datetime string to local datetime string suitable for <input type="datetime-local">
// Returns a string like "YYYY-MM-DDTHH:mm"
function UTCToLocalDateTime(utcISOString) {
  if (!utcISOString) return "";
  const date = new Date(utcISOString);
  // Create a string in the format "YYYY-MM-DDTHH:mm"
  const pad = (num) => num.toString().padStart(2, "0");
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

// Convert UTC ISO datetime string to local time string for display (e.g., "14:30:00")
function UTCToLocalTimeString(utcISOString) {
  if (!utcISOString) return "N/A";
  const date = new Date(utcISOString);
  return date.toLocaleTimeString();
}

// Convert UTC ISO datetime string to local date string for display (e.g., "2025-06-25")
function UTCToLocalDateString(utcISOString) {
  if (!utcISOString) return "N/A";
  const date = new Date(utcISOString);
  return date.toLocaleDateString();
}

// Get the current local time
function getNowLocalDateTime() {
  return UTCToLocalDateTime(new Date().toISOString());
}