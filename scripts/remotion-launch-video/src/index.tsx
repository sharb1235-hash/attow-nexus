import { Composition, registerRoot } from "remotion";
import { AttowNexusLaunch } from "./video";

const Root = () => (
  <Composition
    id="AttowNexusLaunch"
    component={AttowNexusLaunch}
    durationInFrames={1800}
    fps={30}
    width={1920}
    height={1080}
  />
);

registerRoot(Root);
