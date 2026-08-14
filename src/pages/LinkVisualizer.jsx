import { useState } from "react";
// import { ForceGraph2D } from "react-force-graph";
import ForceGraph2D from "react-force-graph-2d";

import { visualizeLinks } from "../api/visualizer";

export default function LinkVisualizer() {
  const [url, setUrl] = useState("");

  const [graphData, setGraphData] = useState({
    nodes: [],
    links: [],
  });
  console.log("LinkVisualizer loaded");

  const handleVisualize = async () => {
    const response = await visualizeLinks(url);

    const nodes = [{ id: url }];

    const links = response.data.connections.map((item) => {
      if (!nodes.find((n) => n.id === item.target)) {
        nodes.push({ id: item.target });
      }

      return {
        source: item.source,
        target: item.target,
      };
    });

    setGraphData({
      nodes,
      links,
    });
  };

  return (
    <>
      <h3>Link Visualizer Test</h3>
      <div>
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://example.com"
        />
      </div>
      &nbsp;
      <div>
        <button onClick={handleVisualize}>Visualize</button>
        <div className="graph-wrapper">
          <ForceGraph2D width={800} height={500} graphData={graphData} />
        </div>
      </div>
    </>
  );
}

// export default function LinkVisualizer() {
//   return (
//     <div>
//       <h1>Link Visualizer Works</h1>
//     </div>
//   );
// }
