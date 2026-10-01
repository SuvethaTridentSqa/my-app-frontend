import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";

function Hello() {
  return <h1>Hello Jest</h1>;
}

function Greeting({ name }) {
  return <p>{name ? `Hello, ${name}!` : "Hello, stranger!"}</p>;
}

function Counter() {
  const [count, setCount] = useState(0);
  return (
    <div>
      <span data-testid="count">{count}</span>
      <button onClick={() => setCount(count + 1)}>Increment</button>
      <button onClick={() => setCount(0)}>Reset</button>
    </div>
  );
}

function NameForm({ onSubmit }) {
  const [value, setValue] = useState("");
  return (
    <div>
      <input
        placeholder="Enter name"
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      <button onClick={() => onSubmit(value)} disabled={!value}>
        Submit
      </button>
    </div>
  );
}

function DelayedMessage() {
  const [msg, setMsg] = useState("Loading...");
  useState(() => {
    setTimeout(() => setMsg("Loaded!"), 50);
  });
  return <p>{msg}</p>;
}

test("renders hello", () => {
  render(<Hello />);
  expect(screen.getByText("Hello Jest")).toBeInTheDocument();
});

describe("Greeting", () => {
  test("shows the name when provided", () => {
    render(<Greeting name="Alice" />);
    expect(screen.getByText("Hello, Alice!")).toBeInTheDocument();
  });

  test("shows fallback when no name is provided", () => {
    render(<Greeting />);
    expect(screen.getByText("Hello, stranger!")).toBeInTheDocument();
  });
});

describe("Counter", () => {
  test("starts at 0", () => {
    render(<Counter />);
    expect(screen.getByTestId("count")).toHaveTextContent("0");
  });

  test("increments when the button is clicked", async () => {
    const user = userEvent.setup();
    render(<Counter />);
    await user.click(screen.getByRole("button", { name: "Increment" }));
    await user.click(screen.getByRole("button", { name: "Increment" }));
    expect(screen.getByTestId("count")).toHaveTextContent("2");
  });

  test("resets back to 0", async () => {
    const user = userEvent.setup();
    render(<Counter />);
    await user.click(screen.getByRole("button", { name: "Increment" }));
    await user.click(screen.getByRole("button", { name: "Reset" }));
    expect(screen.getByTestId("count")).toHaveTextContent("0");
  });
});

describe("NameForm", () => {
  test("submit button is disabled when input is empty", () => {
    render(<NameForm onSubmit={jest.fn()} />);
    expect(screen.getByRole("button", { name: "Submit" })).toBeDisabled();
  });

  test("calls onSubmit with the typed value", async () => {
    const user = userEvent.setup();
    const handleSubmit = jest.fn();
    render(<NameForm onSubmit={handleSubmit} />);

    await user.type(screen.getByPlaceholderText("Enter name"), "Bob");
    await user.click(screen.getByRole("button", { name: "Submit" }));

    expect(handleSubmit).toHaveBeenCalledTimes(1);
    expect(handleSubmit).toHaveBeenCalledWith("Bob");
  });
});

describe("DelayedMessage", () => {
  test("shows loading first, then the loaded message", async () => {
    render(<DelayedMessage />);
    expect(screen.getByText("Loading...")).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByText("Loaded!")).toBeInTheDocument(),
    );
  });
});
