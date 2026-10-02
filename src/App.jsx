import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import "./App.css";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey
);

// The fixed rotation
const rotation = [
  { person: "Abhay", task: "Kettle" },
  { person: "Aniket", task: "Bowl" },
  { person: "Priyanshu", task: "Kettle" },
  { person: "Abhay", task: "Bowl" },
  { person: "Aniket", task: "Kettle" },
  { person: "Priyanshu", task: "Bowl" }
];

const people = [
  "Abhay",
  "Aniket",
  "Priyanshu"
];

function App() {
  const [currentStep, setCurrentStep] = useState(null);
  const [cycle, setCycle] = useState(1);
  const [completedTasks, setCompletedTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  // ------------------------------------------
  // GET CURRENT DATA
  // ------------------------------------------

  const fetchRotation = async () => {
    const { data, error } = await supabase
      .from("rotation")
      .select("*")
      .eq("id", 1)
      .single();

    if (error) {
      console.error("Fetch error:", error);
      setLoading(false);
      return;
    }

    setCurrentStep(data.current_step);
    setCycle(data.cycle);
    setCompletedTasks(data.completed_tasks || []);

    setLoading(false);
  };

  // ------------------------------------------
  // INITIAL LOAD + REALTIME
  // ------------------------------------------

  useEffect(() => {
    fetchRotation();

    const channel = supabase
      .channel("rotation-updates")

      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "rotation",
          filter: "id=eq.1"
        },
        (payload) => {
          console.log(
            "Realtime update:",
            payload.new
          );

          setCurrentStep(
            payload.new.current_step
          );

          setCycle(
            payload.new.cycle
          );

          setCompletedTasks(
            payload.new.completed_tasks || []
          );
        }
      )

      .subscribe((status) => {
        console.log(
          "Realtime status:",
          status
        );
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // ------------------------------------------
  // CURRENT ASSIGNMENT
  // ------------------------------------------

  const currentAssignment =
    currentStep !== null
      ? rotation[currentStep]
      : null;

  // ------------------------------------------
  // CHECK IF TASK IS COMPLETED
  // ------------------------------------------

  const isCompleted = (
    person,
    task
  ) => {
    return completedTasks.some(
      (item) =>
        item.person === person &&
        item.task === task
    );
  };

  // ------------------------------------------
  // CHECK IF THIS IS CURRENT TASK
  // ------------------------------------------

  const isCurrentTask = (
    person,
    task
  ) => {
    if (!currentAssignment) {
      return false;
    }

    return (
      currentAssignment.person === person &&
      currentAssignment.task === task
    );
  };

  // ------------------------------------------
  // COMPLETE TASK
  // ------------------------------------------

  const completeTask = async (
    person,
    task
  ) => {
    if (
      updating ||
      !currentAssignment
    ) {
      return;
    }

    // Make sure only the assigned
    // person/task can be clicked
    if (
      currentAssignment.person !== person ||
      currentAssignment.task !== task
    ) {
      return;
    }

    setUpdating(true);

    // Add completed task
    const newCompletedTasks = [
      ...completedTasks,
      {
        person,
        task
      }
    ];

    // Calculate next step
    const nextStep =
      currentStep + 1;

    // ------------------------------------------
    // NEW CYCLE
    // ------------------------------------------

    if (
      nextStep >= rotation.length
    ) {
      const newCycle = cycle + 1;

      // Immediately update UI
      setCompletedTasks(
        newCompletedTasks
      );

      setCurrentStep(0);

      setCycle(newCycle);

      const { error } =
        await supabase
          .from("rotation")
          .update({
            current_step: 0,
            cycle: newCycle,
            completed_tasks: [],
            updated_at:
              new Date().toISOString()
          })
          .eq("id", 1);

      if (error) {
        console.error(
          "Update error:",
          error
        );

        alert(
          "Could not update the rotation."
        );

        // Reload correct state
        await fetchRotation();
      }

      setUpdating(false);

      return;
    }

    // ------------------------------------------
    // NORMAL STEP
    // ------------------------------------------

    // Update UI immediately
    setCompletedTasks(
      newCompletedTasks
    );

    setCurrentStep(nextStep);

    // Save to Supabase
    const { error } =
      await supabase
        .from("rotation")
        .update({
          current_step: nextStep,
          cycle,
          completed_tasks:
            newCompletedTasks,
          updated_at:
            new Date().toISOString()
        })
        .eq("id", 1);

    if (error) {
      console.error(
        "Update error:",
        error
      );

      alert(
        "Could not update the rotation."
      );

      // Restore database state
      await fetchRotation();
    }

    setUpdating(false);
  };

  // ------------------------------------------
  // RESET
  // ------------------------------------------

  const resetRotation = async () => {
    const confirmed =
      window.confirm(
        "Reset the current rotation?"
      );

    if (!confirmed) {
      return;
    }

    setUpdating(true);

    const { error } =
      await supabase
        .from("rotation")
        .update({
          current_step: 0,
          cycle: 1,
          completed_tasks: [],
          updated_at:
            new Date().toISOString()
        })
        .eq("id", 1);

    if (error) {
      console.error(error);

      alert(
        "Could not reset rotation."
      );
    } else {
      // Immediately update UI
      setCurrentStep(0);
      setCycle(1);
      setCompletedTasks([]);
    }

    setUpdating(false);
  };

  // ------------------------------------------
  // LOADING
  // ------------------------------------------

  if (loading) {
    return (
      <div className="loading">
        Loading Chore Tracker...
      </div>
    );
  }

  // ------------------------------------------
  // UI
  // ------------------------------------------

  return (
    <div className="app">

      <div className="container">

        {/* HEADER */}

        <header>
          <h1>
            Chore Tracker
          </h1>

          <p className="subtitle">
            Bowl & Kettle Rotation
          </p>
        </header>


        {/* NEXT TASK */}

        <section className="next-card">

          <div className="next-label">
            NEXT TO WASH
          </div>

          <div className="next-person">
            {currentAssignment?.person}
          </div>

          <div className="next-task">
            {currentAssignment?.task}
          </div>

          <div className="cycle-info">
            Cycle {cycle}
          </div>

          <div className="progress">
            Step {currentStep + 1}
            {" "}
            of
            {" "}
            {rotation.length}
          </div>

        </section>


        {/* TABLE */}

        <section className="table-card">

          <div className="table-header">

            <div>
              Name
            </div>

            <div>
              Bowl
            </div>

            <div>
              Kettle
            </div>

          </div>


          {people.map(
            (person) => (

              <div
                className="table-row"
                key={person}
              >

                <div className="person-name">
                  {person}
                </div>


                {/* BOWL */}

                <div className="checkbox-cell">

                  <label
                    className={
                      isCurrentTask(
                        person,
                        "Bowl"
                      )
                        ? "current-checkbox"
                        : ""
                    }
                  >

                    <input
                      type="checkbox"

                      checked={isCompleted(
                        person,
                        "Bowl"
                      )}

                      disabled={
                        !isCurrentTask(
                          person,
                          "Bowl"
                        ) ||
                        updating
                      }

                      onChange={() =>
                        completeTask(
                          person,
                          "Bowl"
                        )
                      }
                    />

                    <span className="checkmark">
                    </span>

                  </label>

                </div>


                {/* KETTLE */}

                <div className="checkbox-cell">

                  <label
                    className={
                      isCurrentTask(
                        person,
                        "Kettle"
                      )
                        ? "current-checkbox"
                        : ""
                    }
                  >

                    <input
                      type="checkbox"

                      checked={isCompleted(
                        person,
                        "Kettle"
                      )}

                      disabled={
                        !isCurrentTask(
                          person,
                          "Kettle"
                        ) ||
                        updating
                      }

                      onChange={() =>
                        completeTask(
                          person,
                          "Kettle"
                        )
                      }
                    />

                    <span className="checkmark">
                    </span>

                  </label>

                </div>

              </div>

            )
          )}

        </section>


        {/* ROTATION */}

        <section className="rotation-card">

          <h2>
            Rotation Order
          </h2>

          <div className="rotation-list">

            {rotation.map(
              (item, index) => {

                const completed =
                  index < currentStep;

                const active =
                  index === currentStep;

                return (
                  <div
                    key={index}
                    className={
                      `rotation-item ${
                        active
                          ? "active"
                          : ""
                      } ${
                        completed
                          ? "completed"
                          : ""
                      }`
                    }
                  >

                    <span className="rotation-number">
                      {completed
                        ? "✓"
                        : index + 1}
                    </span>

                    <span>
                      {item.person}
                    </span>

                    <span className="arrow">
                      →
                    </span>

                    <span>
                      {item.task}
                    </span>

                  </div>
                );
              }
            )}

          </div>

        </section>


        {/* RESET */}

        <button
          className="reset-button"
          onClick={resetRotation}
          disabled={updating}
        >
          Reset Rotation
        </button>


        <footer>
          Shared rotation • Cycle {cycle}
        </footer>

      </div>

    </div>
  );
}

export default App;