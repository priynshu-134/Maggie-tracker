import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import "./App.css";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey
);

// --------------------------------------------------
// ROTATION
// --------------------------------------------------

const rotation = [
  {
    person: "Abhay",
    task: "Kettle"
  },
  {
    person: "Aniket",
    task: "Bowl"
  },
  {
    person: "Priyanshu",
    task: "Kettle"
  },
  {
    person: "Abhay",
    task: "Bowl"
  },
  {
    person: "Aniket",
    task: "Kettle"
  },
  {
    person: "Priyanshu",
    task: "Bowl"
  }
];

const people = [
  "Abhay",
  "Aniket",
  "Priyanshu"
];


// --------------------------------------------------
// APP
// --------------------------------------------------

function App() {

  // -----------------------------
  // Rotation state
  // -----------------------------

  const [currentStep, setCurrentStep] =
    useState(null);

  const [cycle, setCycle] =
    useState(1);

  const [completedTasks, setCompletedTasks] =
    useState([]);


  // -----------------------------
  // Auth state
  // -----------------------------

  const [session, setSession] =
    useState(null);

  const [isAdmin, setIsAdmin] =
    useState(false);


  // -----------------------------
  // Login state
  // -----------------------------

  const [email, setEmail] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [loginError, setLoginError] =
    useState("");

  const [loginLoading, setLoginLoading] =
    useState(false);


  // -----------------------------
  // General state
  // -----------------------------

  const [loading, setLoading] =
    useState(true);

  const [updating, setUpdating] =
    useState(false);

  const [showLogin, setShowLogin] =
    useState(false);


  // -----------------------------
  // History
  // -----------------------------

  const [history, setHistory] =
    useState([]);

  // --------------------------------------------------
  // FETCH ROTATION
  // --------------------------------------------------

  const fetchRotation = async () => {

    const { data, error } =
      await supabase
        .from("rotation")
        .select("*")
        .eq("id", 1)
        .single();

    if (error) {

      console.error(
        "Rotation fetch error:",
        error
      );

      return;
    }

    setCurrentStep(
      data.current_step
    );

    setCycle(
      data.cycle
    );

    setCompletedTasks(
      data.completed_tasks || []
    );
  };


  // --------------------------------------------------
  // FETCH HISTORY
  // --------------------------------------------------

  const fetchHistory = async () => {

    const { data, error } =
      await supabase
        .from("rotation_history")
        .select("*")
        .order(
          "created_at",
          {
            ascending: false
          }
        )
        .limit(100);

    if (error) {

      console.error(
        "History fetch error:",
        error
      );

      return;
    }

    setHistory(
      data || []
    );
  };


  // --------------------------------------------------
  // CHECK ADMIN
  // --------------------------------------------------

  const checkAdmin = async (
    currentSession
  ) => {

    if (!currentSession) {

      setIsAdmin(false);

      return;
    }

    const { data, error } =
      await supabase.rpc(
        "is_admin"
      );

    if (error) {

      console.error(
        "Admin check error:",
        error
      );

      setIsAdmin(false);

      return;
    }

    setIsAdmin(
      data === true
    );
  };


  // --------------------------------------------------
  // INITIALIZATION
  // --------------------------------------------------

  useEffect(() => {

    const initialize = async () => {

      const {
        data: {
          session: currentSession
        }
      } =
        await supabase.auth.getSession();

      setSession(
        currentSession
      );

      await checkAdmin(
        currentSession
      );

      await fetchRotation();

      await fetchHistory();

      setLoading(false);
    };


    initialize();


    // -----------------------------
    // AUTH LISTENER
    // -----------------------------

    const {
      data: {
        subscription
      }
    } =
      supabase.auth.onAuthStateChange(
        async (
          _event,
          newSession
        ) => {

          setSession(
            newSession
          );

          await checkAdmin(
            newSession
          );
        }
      );


    // -----------------------------
    // ROTATION REALTIME
    // -----------------------------

    const rotationChannel =
      supabase
        .channel(
          "rotation-realtime"
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "rotation",
            filter: "id=eq.1"
          },
          (payload) => {

            setCurrentStep(
              payload.new.current_step
            );

            setCycle(
              payload.new.cycle
            );

            setCompletedTasks(
              payload.new.completed_tasks ||
              []
            );
          }
        )
        .subscribe();


    // -----------------------------
    // HISTORY REALTIME
    // -----------------------------

    const historyChannel =
      supabase
        .channel(
          "history-realtime"
        )
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "rotation_history"
          },
          (payload) => {

            setHistory(
              (previous) => [
                payload.new,
                ...previous
              ].slice(0, 100)
            );
          }
        )
        .subscribe();


    return () => {

      subscription.unsubscribe();

      supabase.removeChannel(
        rotationChannel
      );

      supabase.removeChannel(
        historyChannel
      );
    };

  }, []);


  // --------------------------------------------------
  // LOGIN
  // --------------------------------------------------

  const handleLogin = async (event) => {

    event.preventDefault();

    setLoginError("");

    setLoginLoading(true);


    const {
      data,
      error
    } =
      await supabase.auth.signInWithPassword({
        email: email.trim(),
        password
      });


    if (error) {

      setLoginError(
        error.message
      );

      setLoginLoading(false);

      return;
    }


    await checkAdmin(
      data.session
    );


    setEmail("");

    setPassword("");

    setShowLogin(false);

    setLoginLoading(false);
  };


  // --------------------------------------------------
  // LOGOUT
  // --------------------------------------------------

  const handleLogout = async () => {

    await supabase.auth.signOut();

    setSession(null);

    setIsAdmin(false);
  };


  // --------------------------------------------------
  // CURRENT ASSIGNMENT
  // --------------------------------------------------

  const currentAssignment =
    currentStep !== null
      ? rotation[currentStep]
      : null;


  // --------------------------------------------------
  // IS COMPLETED?
  // --------------------------------------------------

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


  // --------------------------------------------------
  // IS CURRENT TASK?
  // --------------------------------------------------

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


  // --------------------------------------------------
  // COMPLETE TASK
  // --------------------------------------------------

  const completeTask = async () => {

    if (
      updating ||
      !isAdmin
    ) {

      return;
    }


    setUpdating(true);


    const {
      data,
      error
    } =
      await supabase.rpc(
        "complete_current_task"
      );


    if (error) {

      console.error(
        "Complete task error:",
        error
      );

      alert(
        error.message
      );

      setUpdating(false);

      return;
    }


    // Immediately fetch latest state
    await fetchRotation();

    await fetchHistory();


    console.log(
      "Completed:",
      data
    );


    setUpdating(false);
  };


  // --------------------------------------------------
  // RESET
  // --------------------------------------------------

  const resetRotation = async () => {

    if (!isAdmin) {

      return;
    }


    const confirmed =
      window.confirm(
        "Are you sure you want to reset the rotation?"
      );


    if (!confirmed) {

      return;
    }


    setUpdating(true);


    const {
      error
    } =
      await supabase.rpc(
        "reset_rotation"
      );


    if (error) {

      console.error(
        "Reset error:",
        error
      );

      alert(
        error.message
      );

      setUpdating(false);

      return;
    }


    await fetchRotation();

    await fetchHistory();


    setUpdating(false);
  };


  // --------------------------------------------------
  // LOADING
  // --------------------------------------------------

  if (loading) {

    return (
      <div className="loading">

        <div className="loading-box">

          <div className="spinner"></div>

          <p>
            Loading Chore Tracker...
          </p>

        </div>

      </div>
    );
  }


  // --------------------------------------------------
  // UI
  // --------------------------------------------------

  return (

    <div className="app">

      <div className="container">


        {/* =========================================
            HEADER
        ========================================= */}

        <header className="header">

          <div>

            <h1>
              Chore Tracker
            </h1>

            <p className="subtitle">
              Bowl & Kettle Rotation
            </p>

          </div>


          <div className="auth-area">

            {session && isAdmin ? (

              <div className="logged-in">

                <span className="logged-email">
                  {session.user.email}
                </span>

                <button
                  className="logout-button"
                  onClick={handleLogout}
                >
                  Logout
                </button>

              </div>

            ) : (

              <button
                className="login-button"
                onClick={() =>
                  setShowLogin(true)
                }
              >
                Admin Login
              </button>

            )}

          </div>

        </header>


        {/* =========================================
            READ ONLY NOTICE
        ========================================= */}

        {!isAdmin && (

          <div className="readonly-notice">

            <span className="lock-icon">
              🔒
            </span>

            <span>
              View only — Admin login required
              to make changes.
            </span>

          </div>

        )}


        {/* =========================================
            NEXT TASK
        ========================================= */}

        <section className="next-card">

          <div className="next-label">
            NEXT TO WASH
          </div>

          <div className="upcoming-tasks">

            {/* Current task */}
            <div className="upcoming-task current">

              <span className="upcoming-person">
                {rotation[currentStep]?.person}
              </span>

              <span className="upcoming-task-name">
                {rotation[currentStep]?.task}
              </span>

            </div>


            {/* Next task */}
            <div className="upcoming-task">

              <span className="upcoming-person">
                {
                  rotation[
                    (currentStep + 1) %
                    rotation.length
                  ]?.person
                }
              </span>

              <span className="upcoming-task-name">
                {
                  rotation[
                    (currentStep + 1) %
                    rotation.length
                  ]?.task
                }
              </span>

            </div>

          </div>


          <div className="cycle-info">
            Cycle {cycle}
          </div>

          <div className="progress">
            Step {currentStep + 1} of{" "}
            {rotation.length}
          </div>

        </section>


        {/* =========================================
            TABLE
        ========================================= */}

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
                        !isAdmin ||
                        !isCurrentTask(
                          person,
                          "Bowl"
                        ) ||
                        updating
                      }

                      onChange={
                        completeTask
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
                        !isAdmin ||
                        !isCurrentTask(
                          person,
                          "Kettle"
                        ) ||
                        updating
                      }

                      onChange={
                        completeTask
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


        {/* =========================================
            ROTATION ORDER
        ========================================= */}

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

                    <span className="rotation-person">

                      {item.person}

                    </span>

                    <span className="arrow">

                      →

                    </span>

                    <span className="rotation-task">

                      {item.task}

                    </span>

                  </div>

                );
              }
            )}

          </div>

        </section>


        {/* =========================================
            ADMIN CONTROLS
        ========================================= */}

        {isAdmin && (

          <section className="admin-controls">

            <div>

              <strong>
                Admin Controls
              </strong>

              <p>
                You are logged in as the
                tracker administrator.
              </p>

            </div>

            <button
              className="reset-button"
              onClick={resetRotation}
              disabled={updating}
            >
              Reset Rotation
            </button>

          </section>

        )}


        {/* =========================================
            HISTORY
        ========================================= */}

        <section className="history-card">

          <div className="section-heading">

            <div>

              <h2>
                History
              </h2>

              <p>
                Recent changes to the tracker
              </p>

            </div>

            <span className="history-count">
              {history.length}
            </span>

          </div>


          {history.length === 0 ? (

            <div className="empty-history">

              No changes have been made yet.

            </div>

          ) : (

            <div className="history-list">

              {history.map(
                (item) => (

                  <div
                    className="history-item"
                    key={item.id}
                  >

                    <div className="history-icon">

                      {item.action ===
                      "completed"
                        ? "✓"
                        : "↻"}

                    </div>


                    <div className="history-content">

                      <div className="history-main">

                        <strong>
                          {item.user_email}
                        </strong>

                        {item.action ===
                        "completed" ? (

                          <span>
                            completed{" "}
                            <strong>
                              {item.task}
                            </strong>{" "}
                            for{" "}
                            <strong>
                              {item.person}
                            </strong>
                          </span>

                        ) : (

                          <span>
                            reset the rotation
                          </span>

                        )}

                      </div>


                      <div className="history-meta">

                        {item.cycle && (
                          <span>
                            Cycle {item.cycle}
                          </span>
                        )}

                        <span>
                          {new Date(
                            item.created_at
                          ).toLocaleString()}
                        </span>

                      </div>

                    </div>

                  </div>

                )
              )}

            </div>

          )}

        </section>


        {/* =========================================
            FOOTER
        ========================================= */}

        <footer>

          <span>
            Chore Tracker
          </span>

          <span>
            •
          </span>

          <span>
            Cycle {cycle}
          </span>

        </footer>

      </div>


      {/* =========================================
          LOGIN MODAL
      ========================================= */}

      {showLogin && (

        <div
          className="modal-overlay"
          onClick={() =>
            setShowLogin(false)
          }
        >

          <div
            className="login-modal"
            onClick={(event) =>
              event.stopPropagation()
            }
          >

            <button
              className="close-button"
              onClick={() =>
                setShowLogin(false)
              }
            >
              ×
            </button>


            <div className="login-header">

              <div className="login-icon">
                🔐
              </div>

              <h2>
                Admin Login
              </h2>

              <p>
                Log in to manage the chore
                rotation.
              </p>

            </div>


            <form
              onSubmit={handleLogin}
            >

              <label>
                Email

                <input
                  type="email"
                  value={email}
                  onChange={(event) =>
                    setEmail(
                      event.target.value
                    )
                  }
                  placeholder="Enter your email"
                  required
                  autoComplete="email"
                />

              </label>


              <label>
                Password

                <input
                  type="password"
                  value={password}
                  onChange={(event) =>
                    setPassword(
                      event.target.value
                    )
                  }
                  placeholder="Enter your password"
                  required
                  autoComplete="current-password"
                />

              </label>


              {loginError && (

                <div className="login-error">

                  {loginError}

                </div>

              )}


              <button
                type="submit"
                className="login-submit"
                disabled={loginLoading}
              >

                {loginLoading
                  ? "Logging in..."
                  : "Login"}

              </button>

            </form>

          </div>

        </div>

      )}

    </div>
  );
}

export default App;