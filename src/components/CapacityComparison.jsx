import React, { useState, useMemo, useRef } from 'react';
import { calculateVUtile, calculateCapacity, getCapacityColorClass } from '../utils/capacityCalc';
import { toast } from '../utils/toast';
import './CapacityComparison.css';

/**
 * Tableau comparatif de la capacité utilisée entre plusieurs plans de feu.
 *
 * - L'utilisateur coche les PF à comparer (tous cochés par défaut).
 * - Il choisit le jeu de données trafic appliqué :
 *     • « Jeu associé à chaque PF » (défaut) : chaque PF utilise son dataset
 *       (pfTrafficDatasetMap), à défaut le dataset actif ;
 *     • un jeu unique : le même trafic appliqué à TOUS les PF cochés, pour
 *       isoler l'effet du plan à trafic égal.
 * - Orientation : groupes VL en lignes, PF en colonnes (V.Utile + Cap.U).
 * - Ligne de synthèse : groupe dimensionnant (Cap.U max) par PF.
 *
 * Valeurs nominales de chaque PF (vert/cycle propres), sans actions de
 * simulation : c'est le sens d'une comparaison entre programmes.
 */
const PER_PF = '__per_pf__';

const CapacityComparison = ({
    pfTabs = [],
    groups = [],
    trafficDatasets = {},
    pfTrafficDatasetMap = {},
    activeTrafficDataset = '',
    trafficDatasetNames = [],
    // Sélection contrôlée et persistée dans le projet (via App/useTrafficLight).
    // selectedPfIds null/absent = tous les PF cochés par défaut.
    selectedPfIds = null,
    setSelectedPfIds = () => {},
    datasetChoice = PER_PF,
    setDatasetChoice = () => {}
}) => {
    const [exporting, setExporting] = useState(false);
    const tableRef = useRef(null);

    const allPfIds = useMemo(() => pfTabs.map(pf => pf.id), [pfTabs]);
    // Repli « tous cochés » quand aucune sélection n'est enregistrée.
    const effectiveSelectedIds = Array.isArray(selectedPfIds) ? selectedPfIds : allPfIds;
    const effectiveDatasetChoice = datasetChoice || PER_PF;

    const vlGroups = useMemo(
        () => groups.filter(g => g.type === 'VL' || g.type === 'V'),
        [groups]
    );

    const selectedPfs = useMemo(
        () => pfTabs.filter(pf => effectiveSelectedIds.includes(pf.id)),
        [pfTabs, effectiveSelectedIds]
    );

    const togglePf = (id) => {
        const base = Array.isArray(selectedPfIds) ? selectedPfIds : allPfIds;
        setSelectedPfIds(base.includes(id) ? base.filter(x => x !== id) : [...base, id]);
    };

    // Jeu de trafic effectif pour un PF donné selon le mode choisi.
    // En mode « par PF », on réplique la résolution de l'onglet Trafic :
    // mapping explicite, sinon dataset au nom du PF s'il existe, sinon actif.
    const datasetNameForPf = (pf) =>
        effectiveDatasetChoice === PER_PF
            ? (pfTrafficDatasetMap[pf.id] || (trafficDatasetNames.includes(pf.name) ? pf.name : activeTrafficDataset))
            : effectiveDatasetChoice;

    const trafficVolFor = (pf, groupId) => {
        const ds = datasetNameForPf(pf);
        return trafficDatasets?.[ds]?.[groupId]?.trafficVol ?? 0;
    };

    const greenFor = (pf, group) => {
        const d = pf.diagram?.find(x => x.groupId === group.id);
        const g = (d && d.greenDuration !== undefined && d.greenDuration !== null)
            ? d.greenDuration
            : group.durations?.green;
        return g;
    };

    // Pré-calcul de toutes les cellules : cells[pfId][groupId] = { vUtile, capacity }
    const cells = useMemo(() => {
        const out = {};
        selectedPfs.forEach(pf => {
            const cycle = pf.cycleLength;
            out[pf.id] = {};
            vlGroups.forEach(group => {
                const trafficVol = trafficVolFor(pf, group.id);
                const greenTime = greenFor(pf, group);
                const vUtile = calculateVUtile(trafficVol, group.laneCoef, cycle);
                const capacity = calculateCapacity(greenTime, vUtile);
                out[pf.id][group.id] = { trafficVol, vUtile, capacity, greenTime };
            });
        });
        return out;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedPfs, vlGroups, effectiveDatasetChoice, trafficDatasets, pfTrafficDatasetMap, activeTrafficDataset]);

    const datasetLabelForPf = (pf) => datasetNameForPf(pf) || '—';

    // Un jeu de données est « vide » si aucun groupe n'a de trafic > 0.
    const datasetHasData = (name) => {
        const ds = trafficDatasets?.[name];
        if (!ds) return false;
        return Object.values(ds).some(v => v && Number(v.trafficVol) > 0);
    };

    // Si tous les PF cochés utilisent le MÊME jeu de trafic, le trafic est
    // identique d'un PF à l'autre → une seule colonne Trafic au début suffit
    // (évite la répétition). Sinon, une colonne Trafic par PF (valeurs réelles).
    const effectiveDatasets = selectedPfs.map(datasetNameForPf);
    const uniformDataset = selectedPfs.length > 0
        && effectiveDatasets.every(d => d === effectiveDatasets[0]);
    const uniformDatasetName = uniformDataset ? (effectiveDatasets[0] || '—') : null;
    // Trafic d'un groupe en mode uniforme (pris sur le 1er PF coché).
    const uniformTrafficFor = (groupId) => cells[selectedPfs[0]?.id]?.[groupId]?.trafficVol;

    const handleExport = async () => {
        if (!tableRef.current) return;
        setExporting(true);
        try {
            const { exportElementAsPNG } = await import('../utils/exportHelpers');
            // Fond pris sur le document propriétaire du tableau (fenêtre détachée
            // le cas échéant), pas forcément le document principal.
            const ownerBody = tableRef.current.ownerDocument?.body || document.body;
            const bg = getComputedStyle(ownerBody).backgroundColor || '#1e1e1e';
            const res = await exportElementAsPNG(tableRef.current, 'comparaison_capacite', {
                backgroundColor: bg,
                // Neutralise le sticky des en-têtes dans le clone de capture.
                // `relative` (et non `static`) pour conserver le bloc englobant
                // des libellés en diagonale positionnés en absolu dans le coin.
                onclone: (doc) => {
                    doc.querySelectorAll('.cc-table th, .cc-col-group').forEach(el => {
                        el.style.position = 'relative';
                        el.style.top = 'auto';
                        el.style.left = 'auto';
                    });
                }
            });
            toast.success(res.clipboardSuccess
                ? 'Tableau exporté (PNG téléchargé + copié dans le presse-papiers)'
                : 'Tableau exporté (PNG téléchargé)');
        } catch (e) {
            toast.error('Échec de l\'export : ' + e.message);
        } finally {
            setExporting(false);
        }
    };

    return (
        <div className="capacity-comparison">
            {/* Sélection des PF */}
            <div className="cc-controls">
                <div className="cc-pf-select">
                    <span className="cc-controls-label">Plans de feu à comparer :</span>
                    <div className="cc-pf-checkboxes">
                        {pfTabs.map(pf => (
                            <label key={pf.id} className="cc-pf-checkbox">
                                <input
                                    type="checkbox"
                                    checked={effectiveSelectedIds.includes(pf.id)}
                                    onChange={() => togglePf(pf.id)}
                                />
                                <span>{pf.name}</span>
                            </label>
                        ))}
                    </div>
                </div>
                <div className="cc-dataset-select">
                    <span className="cc-controls-label">Jeu de données trafic :</span>
                    <select value={effectiveDatasetChoice} onChange={(e) => setDatasetChoice(e.target.value)}>
                        <option value={PER_PF}>Jeu associé à chaque PF</option>
                        {trafficDatasetNames.map(name => {
                            const has = datasetHasData(name);
                            return (
                                <option key={name} value={name} disabled={!has}>
                                    {name}{has ? '' : ' (aucune donnée)'}
                                </option>
                            );
                        })}
                    </select>
                </div>
                <div className="cc-export">
                    <button
                        className="cc-export-btn"
                        onClick={handleExport}
                        disabled={exporting || selectedPfs.length === 0 || vlGroups.length === 0}
                        title="Exporter le tableau en image PNG (téléchargée et copiée dans le presse-papiers) pour l'intégrer dans un document"
                    >
                        {exporting ? 'Export…' : 'Exporter (PNG)'}
                    </button>
                </div>
            </div>

            {selectedPfs.length === 0 ? (
                <p className="cc-empty">Cochez au moins un plan de feu pour afficher la comparaison.</p>
            ) : vlGroups.length === 0 ? (
                <p className="cc-empty">Aucun groupe VL à comparer dans ce projet.</p>
            ) : (
                <div className="cc-table-scroll">
                    <table className="cc-table" ref={tableRef}>
                        <thead>
                            <tr>
                                <th rowSpan="2" className="cc-col-group cc-corner">
                                    <span className="cc-corner-pf">Plan de feu</span>
                                    <span className="cc-corner-gf">Groupe de feu</span>
                                </th>
                                {uniformDataset && <th className="cc-trafic-spacer" aria-hidden="true"></th>}
                                {selectedPfs.map(pf => (
                                    <th key={pf.id} colSpan={uniformDataset ? 2 : 3} className="cc-pf-header">
                                        {pf.name}
                                        <span className="cc-pf-dataset" title="Jeu de trafic appliqué">
                                            {uniformDataset
                                                ? `cycle ${pf.cycleLength}s`
                                                : `${datasetLabelForPf(pf)} · cycle ${pf.cycleLength}s`}
                                        </span>
                                    </th>
                                ))}
                            </tr>
                            <tr className="cc-subheader">
                                {uniformDataset && (
                                    <th className="cc-col-trafic-single" title="Trafic (véh/h)">
                                        Trafic<span className="cc-pf-dataset">{uniformDatasetName}</span>
                                    </th>
                                )}
                                {selectedPfs.map(pf => (
                                    <React.Fragment key={pf.id}>
                                        {!uniformDataset && <th title="Trafic (véh/h)">Trafic</th>}
                                        <th title="Vert utile">V.Utile</th>
                                        <th title="Capacité utilisée">Cap.U</th>
                                    </React.Fragment>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {vlGroups.map(group => (
                                <tr key={group.id}>
                                    <td className="cc-col-group">
                                        G{group.id}{group.name ? ` — ${group.name}` : ''}
                                    </td>
                                    {uniformDataset && (
                                        <td className="cc-trafic">
                                            {uniformTrafficFor(group.id) ? uniformTrafficFor(group.id) : '-'}
                                        </td>
                                    )}
                                    {selectedPfs.map(pf => {
                                        const cell = cells[pf.id]?.[group.id];
                                        const cap = cell?.capacity;
                                        return (
                                            <React.Fragment key={pf.id}>
                                                {!uniformDataset && (
                                                    <td className="cc-trafic">
                                                        {cell?.trafficVol ? cell.trafficVol : '-'}
                                                    </td>
                                                )}
                                                <td className="cc-vutile">
                                                    {cell?.vUtile ? `${Math.round(cell.vUtile)}''` : '-'}
                                                </td>
                                                <td className={`cc-capacity ${getCapacityColorClass(cap?.value)}`}>
                                                    {cap?.display || '-'}
                                                </td>
                                            </React.Fragment>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <p className="cc-note">
                Valeurs nominales de chaque PF (vert et cycle propres), hors actions de micro-régulation.
                Code couleur : <span className="capacity-green">&lt; 76 %</span> ·
                <span className="capacity-orange"> ≤ 85 %</span> ·
                <span className="capacity-red"> ≤ 100 %</span> ·
                <span className="capacity-black"> &gt; 100 %</span>.
            </p>
        </div>
    );
};

export default CapacityComparison;
