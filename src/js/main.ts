import { openDB, deleteDB, wrap, unwrap, IDBPDatabase } from "idb";

const $ = document.querySelector.bind(document);

async function openDatabase() {
   return await openDB("database", 1, {
      async upgrade(db: IDBPDatabase<unknown>) {
         const tasksStore = db.createObjectStore("tasks", {
            keyPath: "task"
         })
         const completedStore = db.createObjectStore("completed", {
            autoIncrement: true
         })
         const abandonedStore = db.createObjectStore("abandoned", {
            keyPath: "task"
         })
         const miscStore = db.createObjectStore("misc", {
            keyPath: "id"
         })

         await miscStore.add({value: 0, id: "points"});
      }
   });
}

async function addPoints(amount: number) {
   const db = await openDatabase();

   const transaction = db.transaction("misc", "readwrite");
   const store = transaction.store;

   amount = parseInt(amount.toString());

   if (isNaN(parseInt((await store.get("points")).value))) {
      store.put({value: amount, id: "points"});
   } else {
      store.put({value: parseInt((await store.get("points")).value) + amount, id: "points"});
   }

   updateCounters();
}

async function updateCounters() {
   const db = await openDatabase();

   const misc = db.transaction("misc", "readonly");
   $("#points").innerText = (await misc.store.get("points")).value;

   const tasks = db.transaction("tasks", "readonly");
   $("#pending").innerText = (await tasks.store.count());
   
   const completed = db.transaction("completed", "readonly");
   $("#completed").innerText = (await completed.store.count());
   
   const abandoned = db.transaction("abandoned", "readonly");
   $("#abandoned").innerText = (await abandoned.store.count());
}

async function createTask(task: string, points: number, storeTask: Boolean = true, state: ("pending"|"abandoned"|"completed") = "pending") {
   if (storeTask) {
      const db = await openDatabase();
      const transaction = db.transaction("tasks", "readwrite");
      const store = transaction.store

      store.add({task: task, points: points});
   }

   let newTaskElement = document.createElement("div");
   newTaskElement.className = "task";

   let newTaskNameElement = document.createElement("span");
   newTaskNameElement.className = "taskname text";
   newTaskNameElement.innerText = task;

   let newTaskPointsElement = document.createElement("span");
   newTaskPointsElement.className = "points text";
   newTaskPointsElement.innerText = `${points} Points`;

   if (state == "pending") {
      let completeButton  = document.createElement("button");
      let abandonButton  = document.createElement("button");

      completeButton.className = "create";
      abandonButton.className = "cancel";
      completeButton.style.fontSize = "1em";
      abandonButton.style.fontSize = "1em";

      completeButton.innerText =  "Complete";
      completeButton.addEventListener("click", async (event: Event) => {
         const db = await openDatabase();
         let tasks = db.transaction("tasks", "readwrite").store;
         tasks.delete(task);

         let completed = db.transaction("completed", "readwrite").store;
         completed.add({task: task, points: points})

         addPoints(points);

         $("#completedtasks").appendChild(newTaskElement);
         completeButton.remove();
         abandonButton.remove();
      })

      abandonButton.innerText =  "Abandon";
      abandonButton.addEventListener("click", async (event: Event) => {
         const db = await openDatabase();
         let tasks = db.transaction("tasks", "readwrite").store;
         tasks.delete(task);

         let abandoned = db.transaction("abandoned", "readwrite").store;
         abandoned.add({task: task, points: points})

         addPoints(-Math.round(points/2));
         
         newTaskElement.remove();
         createTask(task, points, false, "abandoned");
      })

      newTaskElement.appendChild(newTaskNameElement);
      newTaskElement.appendChild(document.createElement("br"));
      newTaskElement.appendChild(newTaskPointsElement);
      newTaskElement.appendChild(completeButton);
      newTaskElement.appendChild(abandonButton);
   } else if (state == "abandoned") {
      let completeButton  = document.createElement("button");
      let abandonButton  = document.createElement("button");

      completeButton.className = "create";
      abandonButton.className = "cancel";
      completeButton.style.fontSize = "1em";
      abandonButton.style.fontSize = "1em";

      completeButton.innerText = "Reinstate";
      completeButton.addEventListener("click", async (event: Event) => {
         const db = await openDatabase();
         let tasks = db.transaction("abandoned", "readwrite").store;
         tasks.delete(task);
         addPoints(Math.round(points / 2));
         newTaskElement.remove();

         createTask(task, points, true, "pending");
      })

      newTaskElement.appendChild(newTaskNameElement);
      newTaskElement.appendChild(document.createElement("br"));
      newTaskElement.appendChild(newTaskPointsElement);
      newTaskElement.appendChild(completeButton);
   } else {
      newTaskElement.appendChild(newTaskNameElement);
      newTaskElement.appendChild(document.createElement("br"));
      newTaskElement.appendChild(newTaskPointsElement);
   }
   $(`#${state}tasks`).appendChild(newTaskElement);
   console.log("Created Task!");
}

updateCounters();

$("#newbutton").addEventListener("click", (event: Event) => {
   $("#newtaskdialog").className = "dialog visible";
})

$("#newtaskdialog .cancel").addEventListener("click", (event: Event) => {
   $("#newtaskdialog").className = "dialog";
})
$("#newtaskdialog .create").addEventListener("click", (event: Event) => {
   $("#newtaskdialog").className = "dialog";
   createTask($("#newtaskname").value, $("#newtaskpoints").value);
})

$("#showpending").addEventListener("click", (event: Event) => {
   $("#pendingtasks").style.display = "flex";
   $("#completedtasks").style.display = "none";
   $("#abandonedtasks").style.display = "none";

   $("#showpending").className = "selected";
   $("#showcompleted").className = "";
   $("#showabandoned").className = "";
});
$("#showcompleted").addEventListener("click", (event: Event) => {
   $("#pendingtasks").style.display = "none";
   $("#completedtasks").style.display = "flex";
   $("#abandonedtasks").style.display = "none";

   $("#showpending").className = "";
   $("#showcompleted").className = "selected";
   $("#showabandoned").className = "";
});
$("#showabandoned").addEventListener("click", (event: Event) => {
   $("#pendingtasks").style.display = "none";
   $("#completedtasks").style.display = "none";
   $("#abandonedtasks").style.display = "flex";

   $("#showpending").className = "";
   $("#showcompleted").className = "";
   $("#showabandoned").className = "selected";
});

(async () => {
   const db = await openDatabase();
   for await (let task of db.transaction("tasks").store.iterate()) {
      let val = task.value
      createTask(val.task, parseInt(val.points.toString()), false, "pending")
   }

   for await (let task of db.transaction("completed").store.iterate()) {
      let val = task.value
      createTask(val.task, parseInt(val.points.toString()), false, "completed")
   }

   for await (let task of db.transaction("abandoned").store.iterate()) {
      let val = task.value
      createTask(val.task, parseInt(val.points.toString()), false, "abandoned")
   }
})();
