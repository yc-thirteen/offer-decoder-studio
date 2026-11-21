/**
 * The decoder's single store: React context over decoderReducer. The engine runs
 * once per state change in deriveView(); components call useDecoder() and format.
 */
import {
  createContext,
  useContext,
  useMemo,
  useReducer,
  type Dispatch,
  type ReactNode,
} from "react";
import {
  decoderReducer,
  deriveView,
  initialDecoderState,
  type DecoderAction,
  type DecoderState,
  type DecoderView,
} from "./decoderState";

interface DecoderContextValue {
  state: DecoderState;
  view: DecoderView;
  dispatch: Dispatch<DecoderAction>;
}

const DecoderContext = createContext<DecoderContextValue | null>(null);

export function DecoderProvider({
  children,
  initialSampleId,
}: {
  children: ReactNode;
  /** Sample to load first; null starts empty. Defaults to the first sample. */
  initialSampleId?: string | null;
}) {
  const [state, dispatch] = useReducer(decoderReducer, initialSampleId, initialDecoderState);
  const view = useMemo(() => deriveView(state), [state]);
  const value = useMemo(() => ({ state, view, dispatch }), [state, view]);
  return <DecoderContext.Provider value={value}>{children}</DecoderContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useDecoder(): DecoderContextValue {
  const ctx = useContext(DecoderContext);
  if (!ctx) throw new Error("useDecoder must be used inside <DecoderProvider>.");
  return ctx;
}
