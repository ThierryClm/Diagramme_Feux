import React, { useRef } from 'react';
import './PropertiesPanel.css';

const PHASE_OPTIONS = [
    { value: '', label: '--' },
    { value: 'ESQ', label: 'ESQ - Esquisse' },
    { value: 'AVP', label: 'AVP - Avant-projet' },
    { value: 'PRO', label: 'PRO - Projet' },
    { value: 'DCE', label: 'DCE - Consultation' },
    { value: 'ACT', label: 'ACT - Assistance' },
    { value: 'EXE', label: 'EXE - Exécution' },
    { value: 'DOE', label: 'DOE - Dossier ouvrage' }
];

const LogoBox = ({ logoPath, onSelect, label }) => {
    const fileRef = useRef(null);

    const handleClick = () => {
        fileRef.current?.click();
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
            onSelect(evt.target.result, file.name);
        };
        reader.readAsDataURL(file);
        e.target.value = '';
    };

    return (
        <div className="logo-box" onClick={handleClick}>
            <input
                ref={fileRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={handleFileChange}
            />
            {logoPath && logoPath.startsWith('data:') ? (
                <img src={logoPath} alt="" className="logo-img" />
            ) : (
                <span className="logo-placeholder">Logo</span>
            )}
        </div>
    );
};

const PropertiesPanel = ({ intersectionName, setIntersectionName, projectProperties, updateProjectProperty, appCommunes, appMoaLogos, appMoeLogos }) => {
    const handleIntField = (field, value) => {
        const val = value.replace(/[^0-9]/g, '');
        if (val === '') { updateProjectProperty(field, ''); return; }
        const num = parseInt(val);
        if (num >= 0 && num <= 255) updateProjectProperty(field, val);
    };

    const handleCommuneBlur = () => {
        const commune = projectProperties.commune?.trim();
        if (commune && !projectProperties.moa) {
            updateProjectProperty('moa', commune);
            // Si un logo est associé à cette commune en tant que MOA, le suggérer
            if (appMoaLogos && appMoaLogos[commune] && !projectProperties.logoMoa) {
                updateProjectProperty('logoMoa', appMoaLogos[commune]);
            }
        }
    };

    const handleMoaBlur = () => {
        const moaName = projectProperties.moa?.trim();
        if (moaName && appMoaLogos && appMoaLogos[moaName] && !projectProperties.logoMoa) {
            updateProjectProperty('logoMoa', appMoaLogos[moaName]);
        }
    };

    const handleMoeBlur = () => {
        const moeName = projectProperties.moe?.trim();
        if (moeName && appMoeLogos && appMoeLogos[moeName] && !projectProperties.logoMoe) {
            updateProjectProperty('logoMoe', appMoeLogos[moeName]);
        }
    };

    return (
        <div className="properties-panel">
            <h3 className="properties-title">Propriétés du projet</h3>
            <div className="properties-form">
                <div className="property-field">
                    <label>Nom du carrefour</label>
                    <input type="text" value={intersectionName} onChange={(e) => setIntersectionName(e.target.value)} />
                </div>
                <div className="property-field">
                    <label>Commune</label>
                    <input
                        type="text"
                        list="communes-list"
                        value={projectProperties.commune || ''}
                        onChange={(e) => updateProjectProperty('commune', e.target.value)}
                        onBlur={handleCommuneBlur}
                        placeholder="Saisir ou choisir..."
                    />
                    <datalist id="communes-list">
                        {(appCommunes || []).map(c => (
                            <option key={c} value={c} />
                        ))}
                    </datalist>
                </div>
                <div className="property-field">
                    <label>Id. commune</label>
                    <input type="number" min="0" max="255" value={projectProperties.idCommune || ''} onChange={(e) => handleIntField('idCommune', e.target.value)} />
                </div>
                <div className="property-field">
                    <label>Id. carrefour</label>
                    <input type="number" min="0" max="255" value={projectProperties.idCarrefour || ''} onChange={(e) => handleIntField('idCarrefour', e.target.value)} />
                </div>
                <div className="property-field">
                    <label>Contrôleur</label>
                    <input type="text" value={projectProperties.controleur || ''} onChange={(e) => updateProjectProperty('controleur', e.target.value)} placeholder="Type de contrôleur" />
                </div>
                <div className="property-field">
                    <label>Programme</label>
                    <input type="text" value={projectProperties.programme || ''} onChange={(e) => updateProjectProperty('programme', e.target.value)} placeholder="Nom du programme" />
                </div>
                <div className="property-field">
                    <label htmlFor="horsAgglomeration">Hors agglomération</label>
                    <input
                        type="checkbox"
                        id="horsAgglomeration"
                        checked={!!projectProperties.horsAgglomeration}
                        onChange={(e) => updateProjectProperty('horsAgglomeration', e.target.checked)}
                        title="Hors agglomération : le temps de jaune des groupes VL et Bus passe à 5 secondes"
                        style={{ width: '18px', height: '18px', flex: '0 0 auto', cursor: 'pointer', accentColor: '#3498db' }}
                    />
                </div>
                <div className="property-field">
                    <label>Numéro de dossier</label>
                    <input type="text" value={projectProperties.numeroDossier} onChange={(e) => updateProjectProperty('numeroDossier', e.target.value)} />
                </div>
                <div className="property-field">
                    <label>Phase d'étude</label>
                    <select value={projectProperties.phaseEtude} onChange={(e) => updateProjectProperty('phaseEtude', e.target.value)}>
                        {PHASE_OPTIONS.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                    </select>
                </div>
                <div className="property-separator" />
                <div className="property-field">
                    <label>Maître d'ouvrage</label>
                    <input
                        type="text"
                        value={projectProperties.moa}
                        onChange={(e) => updateProjectProperty('moa', e.target.value)}
                        onBlur={handleMoaBlur}
                    />
                    <LogoBox
                        logoPath={projectProperties.logoMoa}
                        onSelect={(url) => updateProjectProperty('logoMoa', url)}
                        label="MOA"
                    />
                </div>
                <div className="property-field">
                    <label>Concepteur</label>
                    <input
                        type="text"
                        value={projectProperties.moe}
                        onChange={(e) => updateProjectProperty('moe', e.target.value)}
                        onBlur={handleMoeBlur}
                    />
                    <LogoBox
                        logoPath={projectProperties.logoMoe}
                        onSelect={(url) => updateProjectProperty('logoMoe', url)}
                        label="MOE"
                    />
                </div>
                <div className="property-field">
                    <label>Entreprise</label>
                    <input type="text" value={projectProperties.bureauEtudes} onChange={(e) => updateProjectProperty('bureauEtudes', e.target.value)} />
                </div>
                <div className="property-field">
                    <label>Auteur</label>
                    <input type="text" value={projectProperties.auteur} onChange={(e) => updateProjectProperty('auteur', e.target.value)} />
                </div>
                <div className="property-separator" />
                <div className="property-field">
                    <label>Date de création</label>
                    <input type="date" value={projectProperties.dateCreation} onChange={(e) => updateProjectProperty('dateCreation', e.target.value)} />
                </div>
                <div className="property-field">
                    <label>Dernière modification</label>
                    <span className="property-readonly">
                        {projectProperties.dateModification
                            ? new Date(projectProperties.dateModification).toLocaleString('fr-FR')
                            : '—'}
                    </span>
                </div>
                <div className="property-separator" />
                <div className="property-field-full">
                    <label>Commentaires</label>
                    <textarea rows={4} value={projectProperties.commentaires} onChange={(e) => updateProjectProperty('commentaires', e.target.value)} placeholder="Notes et commentaires..." />
                </div>
            </div>
        </div>
    );
};

export default PropertiesPanel;
