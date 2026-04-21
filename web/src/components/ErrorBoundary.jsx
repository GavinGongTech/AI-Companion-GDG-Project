import { Component } from "react";

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{
          padding: "2rem",
          textAlign: "center",
          color: "#f07178",
          fontFamily: "system-ui, sans-serif",
        }}>
          <h2 style={{ marginBottom: "0.5rem" }}>Something went wrong</h2>
          <p style={{ color: "#8b97a8", fontSize: "0.9rem" }}>
            {this.state.error.message || "An unexpected error occurred."}
          </p>
          <button
            onClick={() => this.setState({ error: null })}
            style={{
              marginTop: "1rem",
              padding: "0.5rem 1rem",
              borderRadius: "999px",
              border: "1px solid rgba(255,255,255,0.08)",
              background: "transparent",
              color: "#f2f5f9",
              cursor: "pointer",
              fontSize: "0.85rem",
            }}
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
