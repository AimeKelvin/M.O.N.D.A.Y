import { useMemo, useState } from 'react';
import {
  Box,
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  FolderClosed,
  Layers3,
  Search,
  X,
} from 'lucide-react';
import { Mesh } from 'three';
import { useWorkspace } from '../../stores/workspace';
import { objectName } from '../model-import/model';
import type { TreeNode } from '../model-import/model';
import { IconButton } from '../../components/IconButton';
function TreeRow({ node, depth = 0, search }: { node: TreeNode; depth?: number; search: string }) {
  const [open, setOpen] = useState(depth < 1);
  const selected = useWorkspace((s) => s.selected === node.id),
    hidden = useWorkspace((s) => s.hidden.includes(node.id));
  const matches = (n: TreeNode): boolean =>
    n.name.toLowerCase().includes(search) || n.children.some(matches);
  if (search && !matches(node)) return null;
  return (
    <li>
      <div
        className={`tree-row ${selected ? 'selected' : ''} ${hidden ? 'hidden-object' : ''}`}
        style={{ paddingLeft: 14 + depth * 12 }}
      >
        {node.children.length > 0 ? (
          <button
            className="tree-expand"
            aria-label={`${open ? 'Collapse' : 'Expand'} ${node.name}`}
            onClick={() => setOpen(!open)}
          >
            {open || search ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </button>
        ) : (
          <span className="tree-leaf" />
        )}
        <button
          className="tree-select"
          onClick={() => useWorkspace.getState().select(node.id)}
          title={node.name}
        >
          {node.mesh ? <Box size={13} /> : <FolderClosed size={13} />}
          <span>{node.name}</span>
        </button>
        <button
          className="visibility-button"
          aria-label={`${hidden ? 'Show' : 'Hide'} ${node.name}`}
          onClick={() => useWorkspace.getState().toggleVisibility(node.id)}
        >
          {hidden ? <EyeOff size={13} /> : <Eye size={13} />}
        </button>
      </div>
      {node.children.length > 0 && (open || search) && (
        <ul>
          {node.children.map((n) => (
            <TreeRow key={n.id} node={n} depth={depth + 1} search={search} />
          ))}
        </ul>
      )}
    </li>
  );
}
const number = (n: number) => new Intl.NumberFormat('en').format(n);
export function Inspector({ onClose }: { onClose: () => void }) {
  const model = useWorkspace((s) => s.model),
    selected = useWorkspace((s) => s.selected),
    exploded = useWorkspace((s) => s.exploded);
  const [search, setSearch] = useState('');
  const object = useMemo(
    () => model?.scene.getObjectByProperty('uuid', selected ?? ''),
    [model, selected],
  );
  const metadata = object
    ? Object.entries(object.userData)
        .filter(
          ([key, value]) =>
            !['explode', 'name'].includes(key) &&
            ['string', 'number', 'boolean'].includes(typeof value),
        )
        .slice(0, 8)
    : [];
  return (
    <aside className="inspector" aria-label="Model inspector">
      <div className="panel-title">
        <span>
          <Layers3 size={15} /> Scene explorer
        </span>
        <IconButton label="Close scene explorer" onClick={onClose}>
          <X size={16} />
        </IconButton>
        <span className="tiny-count desktop-only">{model?.meshCount ?? '—'}</span>
      </div>
      <div className="scene-file">
        <span className="file-icon">
          <Box size={17} />
        </span>
        <div>
          <strong>{model?.name ?? 'No model loaded'}</strong>
          <small>{model?.demo ? 'DEMONSTRATION ASSEMBLY' : 'LOCAL MODEL'}</small>
        </div>
        <span className="file-format">
          {model?.demo ? 'GLB' : model?.name.split('.').pop()?.toUpperCase()}
        </span>
      </div>
      <label className="search-field">
        <Search size={14} />
        <input
          aria-label="Find a component"
          placeholder="Find a component…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <kbd>/</kbd>
      </label>
      <div className="section-caption">
        <span>HIERARCHY</span>
        <span>{model?.meshCount ?? 0} meshes</span>
      </div>
      <div className="hierarchy">
        <ul aria-label="Scene hierarchy">
          {model?.tree.map((n) => (
            <TreeRow key={n.id} node={n} search={search.toLowerCase()} />
          ))}
        </ul>
      </div>
      <section className="inspector-section selection-section">
        <div className="section-caption">
          <span>INSPECTOR</span>
          {object && (
            <button className="text-button" onClick={() => useWorkspace.getState().select(null)}>
              Clear
            </button>
          )}
        </div>
        {object ? (
          <>
            <h3>
              <Box size={14} />
              {objectName(object)}
            </h3>
            <dl className="properties">
              <div>
                <dt>Type</dt>
                <dd>{object instanceof Mesh ? 'Mesh' : 'Group'}</dd>
              </div>
              {object instanceof Mesh && (
                <div>
                  <dt>Vertices</dt>
                  <dd>{number(object.geometry.getAttribute('position')?.count ?? 0)}</dd>
                </div>
              )}
              {metadata.map(([key, value]) => (
                <div key={key}>
                  <dt>{key}</dt>
                  <dd title={String(value)}>{String(value)}</dd>
                </div>
              ))}
            </dl>
          </>
        ) : (
          <div className="empty-selection">
            <Box size={20} strokeWidth={1.2} />
            <p>A closer look starts here.</p>
            <small>
              Select a component in the scene
              <br />
              or point with your index finger.
            </small>
          </div>
        )}
      </section>
      {model?.hasExplode && (
        <section className="inspector-section">
          <label className="range-label" htmlFor="explode">
            <span>Exploded view</span>
            <span>{Math.round(exploded * 100)}%</span>
          </label>
          <input
            id="explode"
            aria-label="Exploded view"
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={exploded}
            onChange={(e) => useWorkspace.getState().set({ exploded: Number(e.target.value) })}
          />
          <small className="muted">Explore the prepared assembly.</small>
        </section>
      )}
      <section className="inspector-section model-stats">
        <div className="section-caption">
          <span>MODEL INFORMATION</span>
          <span className="local-dot">LOCAL</span>
        </div>
        <dl className="properties">
          <div>
            <dt>Meshes</dt>
            <dd>{model ? number(model.meshCount) : '—'}</dd>
          </div>
          <div>
            <dt>Triangles</dt>
            <dd>{model ? number(model.triangles) : '—'}</dd>
          </div>
          <div>
            <dt>File size</dt>
            <dd>{model ? `${(model.bytes / 1024 / 1024).toFixed(2)} MB` : '—'}</dd>
          </div>
          <div>
            <dt>Dimensions</dt>
            <dd>{model ? model.dimensions.map((n) => n.toFixed(2)).join(' × ') : '—'}</dd>
          </div>
        </dl>
        <small className="muted">Dimensions in source model units.</small>
      </section>
      <div className="inspector-bottom">
        <span className="status-dot" /> All processing stays on your device
      </div>
    </aside>
  );
}
