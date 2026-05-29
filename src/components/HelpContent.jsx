import React, { useState, useEffect, useRef } from 'react';

/**
 * Aide en ligne (F1) — contenu partagé entre App.jsx et GreenWavePage.jsx.
 *
 * Le composant gère lui-même :
 *  - la ref vers le conteneur scrollable (helpContentRef)
 *  - l'état du sommaire (helpToc)
 *  - l'effet qui scanne les h3/h4 pour construire le sommaire au montage
 *
 * Props :
 *  - initialAnchor (string, optionnel) : si fourni, scrolle vers l'élément
 *    portant cet id 300 ms après le montage (utile pour l'ouverture via
 *    ?openHelp=ondeVerte qui doit cibler "help-onde-verte").
 */
const HelpContent = ({ initialAnchor = null }) => {
    const helpContentRef = useRef(null);
    const [helpToc, setHelpToc] = useState([]);

    // Build the help TOC by scanning h3 (chapters) and h4 (sections) and assigning ids
    useEffect(() => {
        const root = helpContentRef.current;
        if (!root) return;
        const slug = (s) => s.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').substring(0, 60);
        const toc = [];
        let currentChapter = null;
        root.querySelectorAll('h3, h4').forEach(node => {
            // Remove any previously-injected "back to TOC" link before reading text
            const existing = node.querySelector('.back-to-toc');
            if (existing) existing.remove();
            const text = node.textContent.trim();
            if (!node.id) node.id = slug(text);
            if (node.tagName === 'H3') {
                currentChapter = { id: node.id, title: text, sections: [] };
                toc.push(currentChapter);
            } else if (node.tagName === 'H4' && currentChapter) {
                currentChapter.sections.push({ id: node.id, title: text });
            }
        });
        setHelpToc(toc);
    }, []);

    // Scroll to anchor when initialAnchor is provided (deep link from URL param)
    useEffect(() => {
        if (!initialAnchor) return;
        const t = setTimeout(() => {
            const el = document.getElementById(initialAnchor);
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 300);
        return () => clearTimeout(t);
    }, [initialAnchor]);

    return (
        <div className="help-content" ref={helpContentRef}>
            {helpToc.length > 0 && (
                <nav id="help-sommaire" className="help-toc" style={{ background: '#2a2a2a', border: '1px solid #444', borderRadius: '6px', padding: '12px 16px', marginBottom: '20px' }}>
                    <h3 style={{ color: '#4ecdc4', marginTop: 0, marginBottom: '10px', fontSize: '1em' }}>Sommaire</h3>
                    {helpToc.map(chapter => (
                        <div key={chapter.id} style={{ marginBottom: '8px' }}>
                            <a
                                href={`#${chapter.id}`}
                                onClick={(e) => { e.preventDefault(); document.getElementById(chapter.id)?.scrollIntoView({ behavior: 'auto', block: 'start' }); }}
                                style={{ color: '#4ecdc4', fontWeight: 'bold', textDecoration: 'none' }}
                            >
                                {chapter.title}
                            </a>
                            {chapter.sections.length > 0 && (
                                <ul style={{ margin: '4px 0 0 20px', padding: 0, listStyle: 'disc' }}>
                                    {chapter.sections.map(s => (
                                        <li key={s.id} style={{ margin: '2px 0' }}>
                                            <a
                                                href={`#${s.id}`}
                                                onClick={(e) => { e.preventDefault(); document.getElementById(s.id)?.scrollIntoView({ behavior: 'auto', block: 'start' }); }}
                                                style={{ color: '#ccc', textDecoration: 'none' }}
                                                onMouseEnter={(e) => e.target.style.color = '#fff'}
                                                onMouseLeave={(e) => e.target.style.color = '#ccc'}
                                            >
                                                {s.title}
                                            </a>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    ))}
                </nav>
            )}
            <h3 style={{ color: '#4ecdc4', borderBottom: '1px solid #4ecdc4', paddingBottom: '8px', marginBottom: '16px' }}>Chapitre 1 — Boite à outils d'optimisation des diagrammes de feu</h3>
            <section className="help-section">
                <h4>Présentation</h4>
                <p>Application de conception de diagrammes de feux pour carrefours à feux.</p>
                <p>Elle permet de concevoir, visualiser et valider les plans de feux d'un carrefour à feux tricolores. L'application couvre l'ensemble du processus : définition des groupes de feux (ou lignes de feu) et de leurs paramètres temporels (vert, orange, rouge), saisie de la matrice des temps de dégagement entre groupes conflictuels, configuration des actions de micro-régulation (adaptatif, escamotage, fermeture anticipée, ouverture anticipée), gestion des données de trafic et de capacité, et coordination des feux sur un axe via l'outil onde verte. Elle génère un dossier imprimable complet incluant le formulaire, les matrices, les diagrammes, le phasage bulle et les conditions de micro-régulation pour chaque plan de feu.</p>
                <p>Chaque modification se répercute instantanément sur l'ensemble de l'interface : ajustez un temps de vert dans le formulaire et le diagramme se redessine en temps réel ; déplacez une barre directement sur le diagramme et les valeurs du formulaire suivent ; modifiez la matrice des temps interverts et la détection des conflits se met à jour immédiatement. Cette interactivité permanente entre le formulaire, le diagramme, la matrice et le tableau des actions vous offre une vision globale et cohérente à chaque instant.</p>
                <p>Le glisser-déposer des barres, la surbrillance croisée entre le tableau des actions et le diagramme, les flèches de dépendance, le calcul automatique des conflits et des données trafic : tout est pensé pour vous accompagner dans la mise au point de vos plans de feux, de la première esquisse jusqu'à la validation finale.</p>
                <p><strong>Une ergonomie pensée pour tout utilisateur allant de néophyte à traficien ou expert.</strong> L'application met l'accent sur le détail qui fait la différence : les éléments du diagramme livrent leurs informations clés au simple survol, sans clic ; les états vides guident pas à pas le renseignement initial (types de groupes, matrice d'interverts, durées de vert) ; les opérations sensibles (sauvegarde, duplication, annulation) donnent lieu à des notifications discrètes ; le basculement entre plans de feux, le drag direct sur le diagramme ou la détection temps-réel des conflits se font sans rupture. Autant d'attentions qui laissent à l'utilisateur toute la place pour son analyse, plutôt que de le contraindre dans un workflow figé. La souplesse de l'application épouse le niveau de connaissance de son utilisateur : accessible à qui découvre la régulation de trafic, elle déploie toute sa richesse aux mains d'un praticien expérimenté.</p>
            </section>

            <section id="help-interface" className="help-section">
                <h4>Interface principale</h4>
                <p><strong>Pour découvrir l'application :</strong> sur l'écran d'accueil (avant d'ouvrir un projet), cliquez sur <em>« Découvrir avec un projet exemple »</em> — un carrefour exemple anonymisé s'ouvre dans une nouvelle fenêtre. Le module Onde verte propose de même une onde verte exemple. Rien n'est enregistré tant que vous ne sauvegardez pas.</p>
                <ul>
                    <li><strong>En-tête :</strong> Nom du carrefour, nombre de groupes, durée du cycle, zoom</li>
                    <li><strong>Panneau gauche :</strong> Onglets Projets, Configuration et Trafic</li>
                    <li><strong>Zone centrale :</strong> Diagramme temporel et tableau des conditions de micro-régulation</li>
                    <li><strong>Onglets PF :</strong> Gérez plusieurs plans de feux (PF1, PF2...) :
                        <ul>
                            <li><em>Ajouter :</em> Cliquez sur le bouton "+" pour créer un nouveau plan de feux vierge.</li>
                            <li><em>Dupliquer :</em> Via le menu Diagramme → Dupliquer, crée un nouvel onglet avec une copie du plan actuel.</li>
                            <li><em>Renommer :</em> Double-cliquez sur un onglet PF pour modifier son nom.</li>
                            <li><em>Réordonner :</em> Glissez-déposez un onglet PF pour modifier l'ordre des plans de feux.</li>
                            <li><em>Supprimer :</em> Via le menu Diagramme → Supprimer, supprime l'onglet PF actif (impossible s'il n'en reste qu'un).</li>
                        </ul>
                    </li>
                    <li><strong>Indicateur Valider/Validé :</strong> Cliquez sur "Valider" (quand aucun conflit) pour marquer l'onglet PF en vert. Cliquez à nouveau pour annuler la validation.</li>
                    <li><strong>Séparateur ajustable :</strong> La position du séparateur entre le diagramme et les conditions de micro-régulation est sauvegardée avec le projet.</li>
                </ul>
            </section>

            <section className="help-section">
                <h4>Mise en page de l'interface et optimisation de l'écran</h4>
                <p><strong>Installer TraCflux comme application (optionnel) :</strong> pour une expérience plus proche d'une application native — raccourci dans le menu Démarrer, fenêtre sans onglets ni barre d'adresse, lancement direct depuis la barre des tâches — cliquez sur le bouton <strong>« Installer cette app »</strong> qui apparaît dans la barre d'adresse de Chrome ou Edge lorsque vous visitez TraCflux. Confirmez l'installation : TraCflux devient une vraie app sur votre poste, avec son propre raccourci. L'usage standard dans un onglet de navigateur reste évidemment possible et fonctionnellement identique ; l'installation ne fait que changer l'enveloppe visuelle.</p>
                <p><strong>Principe du détachement :</strong> les fenêtres détachées (matrice, formulaire, image du carrefour, données trafic, conditions micro, variables micro, remarques) sont conçues pour être <strong>placées sur un second écran</strong> pendant que la fenêtre principale reste sur votre écran de travail. Vous libérez ainsi tout l'espace de l'écran principal pour le diagramme, tout en gardant en permanence visible sur l'écran annexe la ressource dont vous avez besoin (matrice intervert pendant le réglage du diagramme, image du carrefour pendant une présentation à un client, etc.). Sans second écran, le détachement reste utile pour superposer ponctuellement une fenêtre sur la principale.</p>
                <ul>
                    <li><strong>Zoom du diagramme :</strong> Le curseur "Zoom" dans l'en-tête permet d'ajuster l'échelle horizontale du diagramme (de 4 à 20 px/s). Vous pouvez également utiliser <strong>Ctrl + molette de la souris</strong> pour zoomer ou dézoomer la page entière.</li>
                    <li><strong>Séparateur vertical :</strong> La barre de séparation entre le panneau de configuration (à gauche) et la zone du diagramme (à droite) est déplaçable par glisser-déposer. Sa position est sauvegardée automatiquement.</li>
                    <li><strong>Séparateur horizontal :</strong> La barre de séparation entre le diagramme (en haut) et le tableau des conditions de micro-régulation (en bas) est également déplaçable par glisser-déposer. Sa position est sauvegardée avec le projet.</li>
                    <li><strong>Masquer le panneau de configuration :</strong> Le bouton "Paramètre" dans l'en-tête permet de masquer ou d'afficher le panneau de configuration à gauche, libérant ainsi toute la largeur de l'écran pour le diagramme.</li>
                    <li><strong>Image du carrefour :</strong> Le menu Mise en page permet d'afficher ou masquer la fenêtre détachée de l'image du carrefour. L'option est grisée si aucune image n'est chargée. La fenêtre peut être déplacée sur un autre écran.</li>
                    <li><strong>Matrice des temps interverts :</strong> Le menu Mise en page (ou le bouton "Détacher" dans l'onglet Matrice) ouvre la matrice dans une fenêtre séparée, déplaçable sur un autre écran. La matrice reste éditable depuis la fenêtre détachée.</li>
                    <li><strong>Sauvegarde des détachements dans le projet :</strong> Chaque projet retrouve à l'ouverture sa propre configuration de fenêtres détachées (Formulaire, Matrice, Données trafic, Image, Conditions micro, Variables micro). Les dimensions des popups s'adaptent au nombre de groupes du projet.</li>
                    <li><strong>Sauvegarde des options de mise en page dans le projet :</strong> Les états des cases <em>Affichage des paramètres</em>, <em>Commentaires du diagramme</em>, <em>Remarques du diagramme</em> et <em>Description des conditions micro</em> sont enregistrés avec le projet et restaurés à l'ouverture.</li>
                    <li><strong>Espace de travail propre au nouveau projet :</strong> L'ouverture d'un nouveau projet (ou d'un ancien projet sans options enregistrées) ferme automatiquement toutes les fenêtres détachées. Vous détachez ensuite uniquement ce dont vous avez besoin pour ce projet.</li>
                    <li><strong>Sous-menus persistants :</strong> Les sous-menus <em>Mise en page</em> et <em>Détachements</em> restent ouverts après chaque clic sur une option, ce qui facilite le réglage de plusieurs cases à la suite.</li>
                    <li><strong>Fenêtres détachées au premier plan :</strong> Lorsque vous cliquez dans la fenêtre principale, les fenêtres détachées passent momentanément derrière. Elles remontent automatiquement au premier plan après environ une seconde d'inactivité, sans voler le focus pendant la frappe.</li>
                    <li><strong>Fenêtre détachée hors écran :</strong> Après un changement de poste ou la déconnexion d'un écran secondaire, décochez puis recochez la fenêtre concernée dans le menu <strong>Mise en page → Détachements</strong> : elle réapparaîtra centrée sur l'écran principal.</li>
                    <li><strong>Popups bloquées par le navigateur :</strong> Les navigateurs n'autorisent qu'une seule fenêtre détachée à la fois lors de l'ouverture d'un projet contenant plusieurs détachements. Pour les autoriser toutes en une fois, ajoutez le site à la liste des popups autorisés :
                        <ul>
                            <li><strong>Chrome / Edge :</strong> cliquez sur l'icône <em>popup bloqué</em> qui apparaît dans la barre d'adresse, puis choisissez « Toujours autoriser les popups depuis ce site ». Alternative : <code>chrome://settings/content/popups</code> → ajouter l'URL du site dans <em>« Sites autorisés à envoyer des popups »</em>.</li>
                            <li><strong>Firefox :</strong> Paramètres → Vie privée et sécurité → Permissions → Bloquer les fenêtres popups → <em>Exceptions</em> → ajouter le site.</li>
                        </ul>
                        Une fois autorisées, plus aucun message de blocage n'apparaîtra et toutes les fenêtres détachées s'ouvriront simultanément à l'ouverture d'un projet.
                    </li>
                    <li><strong>Largeur dynamique du panneau de configuration :</strong> Lorsque le nom des groupes de feux est masqué, ce panneau libère 160 px supplémentaires pour le diagramme.</li>
                    <li><strong>Remarques du diagramme :</strong> Le menu <strong>Mise en page → Détachements</strong> permet d'ouvrir le champ Remarques du plan de feu actif dans une fenêtre séparée, déplaçable sur un second écran. Pratique lors d'une projection : le diagramme reste visible sur l'écran principal pendant que vous gardez vos notes sur un écran annexe pour commenter la présentation. L'option est grisée tant que la case <em>Remarques du diagramme</em> n'est pas cochée dans le menu Mise en page (impossible de détacher un champ masqué).</li>
                    <li><strong>Zoom indépendant dans chaque fenêtre détachée :</strong> Chaque popup (Formulaire, Matrice, Trafic, Conditions micro, Variables micro, Image, Remarques) accepte le zoom natif du navigateur sans affecter la fenêtre principale. Utilisez <strong>Ctrl + molette de la souris</strong> pour zoomer/dézoomer, ou <strong>Ctrl++</strong> / <strong>Ctrl+-</strong>, et <strong>Ctrl+0</strong> pour revenir à 100 %. Pratique pour optimiser la lecture sur un grand écran ou un vidéoprojecteur sans modifier la mise en page de l'application principale. Selon le navigateur, le niveau de zoom peut être mémorisé d'une session à l'autre.</li>
                    <li><strong>Confirmation à la fermeture :</strong> Si le projet a été modifié sans être sauvegardé, le navigateur affiche une confirmation avant de fermer l'onglet ou la fenêtre.</li>
                    <li><strong>Désactivation des infobulles par section :</strong> Le menu <strong>Mise en page → Infobulles...</strong> ouvre un sous-menu où chaque section de l'interface (<em>Page principale</em>, <em>Configuration</em>, <em>Diagramme</em>, <em>Matrice</em>, <em>Trafic</em>, <em>Conditions de micro-régulation</em>) peut être cochée individuellement. Décocher une section masque toutes ses infobulles — utile pour épurer l'interface une fois familiarisé avec l'outil. Préférence enregistrée au niveau de l'application (s'applique à tous les projets).</li>
                </ul>
            </section>

            <section className="help-section">
                <h4>Options de contraste</h4>
                <p>Le menu Préférences → Options de contraste permet de choisir parmi 7 thèmes de couleurs pour l'interface :</p>
                <ul>
                    <li><strong>Blanc sur fond noir :</strong> Thème par défaut, texte clair sur fond sombre. Adapté au travail prolongé en environnement peu éclairé.</li>
                    <li><strong>Noir sur fond blanc :</strong> Thème clair, texte noir sur fond blanc. Proche du rendu à l'impression.</li>
                    <li><strong>Haut contraste :</strong> Fond bleu marine, titres jaunes, noms cyan. Conçu pour une lisibilité maximale, notamment en conditions de forte luminosité.</li>
                    <li><strong>Ambre :</strong> Fond anthracite, titres et accents ambrés/dorés. Thème chaleureux qui réduit la fatigue visuelle.</li>
                    <li><strong>Daltonien :</strong> Palette adaptée aux daltonismes courants (deutéranopie, protanopie). Privilégie les couleurs bleu/orange/cyan plutôt que vert/rouge — particulièrement utile dans une application traitant intensivement de feux tricolores.</li>
                    <li><strong>Sépia :</strong> Tons chauds beige et brun, inspirés des liseuses. Anti-fatigue pour les longues sessions de paramétrage.</li>
                    <li><strong>Bleu nuit :</strong> Palette Solarized Dark, alternative douce au thème sombre par défaut. Bleu-vert profond avec accents pastel.</li>
                </ul>
                <p>Le choix du thème est sauvegardé automatiquement dans le navigateur et propagé aux fenêtres détachées (matrice, formulaire, données trafic, conditions micro, variables micro, image du carrefour). Le sous-menu reste ouvert après sélection pour faciliter la comparaison entre thèmes.</p>
            </section>

            <section id="help-config-groupes" className="help-section">
                <h4>Configuration des groupes</h4>
                <p>Champs du formulaire (panneau de configuration), dans l'ordre des colonnes :</p>
                <ul>
                    <li><strong>GF :</strong> Numéro du groupe de feux (1, 2, 3…), attribué automatiquement. Sert de référence dans la matrice et les actions de micro-régulation.</li>
                    <li><strong>Nom :</strong> Libellé descriptif libre (ex. <em>« rue Tabaga »</em>). Affiché dans le diagramme.</li>
                    <li><strong>Type :</strong> Catégorie d'usager du groupe de feux.
                        <ul>
                            <li><em>V :</em> Véhicules</li>
                            <li><em>B :</em> Bus / transports en commun</li>
                            <li><em>P :</em> Piéton</li>
                            <li><em>CY :</em> Cycliste</li>
                            <li><em>FL :</em> Flèche d'anticipation</li>
                            <li><em>PP :</em> Priorité piéton</li>
                        </ul>
                    </li>
                    <li><strong>Courant :</strong> Mouvement de trafic associé au groupe.
                        <ul>
                            <li><em>TD :</em> Tout droit</li>
                            <li><em>TàD :</em> Tourne à droite</li>
                            <li><em>TàG :</em> Tourne à gauche</li>
                            <li><em>TD_TàD :</em> Tout droit + tourne à droite</li>
                            <li><em>TD_TàG :</em> Tout droit + tourne à gauche</li>
                            <li><em>TD_G_D :</em> Tout droit + tourne à gauche et à droite</li>
                            <li><em>Piéton :</em> Mouvement piéton (2 sens)</li>
                            <li><em>Cycle :</em> Mouvement cycliste (2 sens)</li>
                        </ul>
                    </li>
                    <li><strong>Mini :</strong> Durée minimale du vert garantie (en secondes), utilisée par la micro-régulation.</li>
                    <li><strong>Jaune :</strong> Durée du feu jaune/orange. <em>Pour les types Piéton et Cycliste, ce champ correspond au temps de dégagement (affiché dans le diagramme après le vert).</em></li>
                </ul>
            </section>

            <section id="help-matrice" className="help-section">
                <h4>Matrice des temps interverts</h4>
                <p>Définit les temps de dégagement (intervert) entre groupes conflictuels.
                Valeurs acceptées : 3 à 20 secondes.</p>
                <p>Dans les différents plans de feux, les valeurs de la matrice sont affichées selon un code couleur :</p>
                <ul>
                    <li><strong style={{ color: '#fff' }}>Blanc :</strong> Valeur de base, telle que définie dans le plan de feux de référence (PF1).</li>
                    <li><strong style={{ color: '#4caf50' }}>Vert :</strong> Valeur réévaluée à la baisse par rapport au PF1 pour tenir compte des temps de dégagement.</li>
                    <li><strong style={{ color: '#f44336' }}>Rouge :</strong> Valeur ajustée à la hausse par rapport au PF1.</li>
                    <li><strong style={{ color: '#fff', background: 'rgba(255,0,0,0.3)', padding: '0 4px', borderRadius: '2px' }}>Fond rouge :</strong> Conflit détecté — le temps de dégagement requis n'est pas respecté dans le diagramme.</li>
                    <li><strong style={{ color: '#fff', background: 'rgba(255,165,0,0.3)', padding: '0 4px', borderRadius: '2px' }}>Fond orange :</strong> Valeur manquante — une case symétrique (GFx→GFy / GFy→GFx) n'est pas renseignée, ce qui compromet la symétrie de la matrice.</li>
                </ul>
                <p>Au survol stable d'une case pendant <strong>une seconde</strong>, une infobulle apparaît si elle a quelque chose à dire :</p>
                <ul>
                    <li>la valeur diffère du PF de référence (PF1) → l'écart est précisé : <em>« Augmentée / Réduite de X s vs PF de base (PF1) : a → b »</em> ;</li>
                    <li>la case est en <strong style={{ background:'rgba(255,0,0,0.3)', padding:'0 4px', borderRadius:'2px' }}>fond rouge</strong> → le problème est décrit : recouvrement des verts, ou intervert demandé supérieur au délai réel disponible entre fin de vert d'un groupe et début de vert de l'autre.</li>
                </ul>
                <p>Le délai d'une seconde évite l'apparition d'infobulles à la chaîne lors d'un balayage rapide de la grille.</p>
            </section>

            <section id="help-diagramme" className="help-section">
                <h4>Diagramme</h4>
                <ul>
                    <li><strong>DA :</strong> Correspond au code trajet d'une ligne de bus en délai d'approche, communément noté T0, T1, T2...</li>
                    <li><strong>Déb (Début de vert) :</strong> Position de départ du vert dans le cycle (en secondes depuis le début du cycle)</li>
                    <li><strong>Fin (Fin de vert) :</strong> Position de fin du vert dans le cycle (en secondes depuis le début du cycle)</li>
                    <li><strong>Durée :</strong> Durée du feu vert, calculée automatiquement comme la différence entre Fin et Déb</li>
                    <li><strong>Indicateur aiguillage/escamotage :</strong> Lorsqu'une action <em>Escamotage</em> est définie dans les conditions de micro-régulation, un petit "e" s'affiche automatiquement en haut à droite du nom des groupes concernés (GF source et Action GF cibles). Les conflits où ce groupe est en première position (GFx dans "GFx ↔ GFy") sont alors grisés et non comptabilisés, ce qui peut permettre de valider le plan de feux. Il est également possible de poser manuellement cet indicateur : cliquez sur un nom de groupe puis utilisez <em>Alt+A</em> (aiguillage) ou <em>Alt+E</em> (escamotage) pour marquer le groupe. Un indicateur posé manuellement n'est pas écrasé par l'automatisme.</li>
                    <li><strong>Mode simulation :</strong> Lorsque l'onglet Simulation est actif, le diagramme passe en mode lecture seule : les valeurs DA, Déb, Fin et la durée du cycle ne sont plus modifiables. Le diagramme affiche en temps réel l'effet des actions de micro-régulation cochées dans le panneau de simulation. Les zones contractées (Adaptatif vertical, Escamotage de phase) réduisent visuellement le cycle, les fermetures anticipées ajustent les fins de vert, et les actions de micro-régulation (Priorité piétons, Signal aide conduite, Flèche d'anticipation) suivent les décalages. Ce mode permet de vérifier le comportement du carrefour sous différentes combinaisons d'actions avant la mise en service.</li>
                </ul>
            </section>

            <section id="help-actions" className="help-section">
                <h4>Colonnes du tableau des actions de micro-régulation</h4>
                <ul>
                    <li><strong>GF :</strong> Groupe fonctionnel concerné par l'action</li>
                    <li><strong>Action :</strong> Type d'action (liste déroulante)</li>
                    <li><strong>Description :</strong> Description libre (30 caractères max)</li>
                    <li><strong>Déb/Fin :</strong> Temps de début et fin de l'action dans le cycle</li>
                    <li><strong>Abrv :</strong> Abréviation affichée sur le diagramme</li>
                    <li><strong>Action_Micro :</strong> Action de micro-régulation appliquée au diagramme (40 caractères)</li>
                    <li><strong>Plage 1/2 :</strong> Groupes délimitant la zone verticale (Adaptatif)</li>
                    <li><strong>Action GF 1-4 :</strong> Groupes liés à l'action (Fermeture anticipée, Escamotage)</li>
                </ul>
                <p>Les colonnes <strong>Description</strong>, <strong>Abrv</strong> et <strong>Action_Micro</strong> sont <strong>redimensionnables</strong> : glissez la poignée à droite de leur en-tête pour ajuster la largeur (les autres colonnes ne bougent pas) ; double-clic sur la poignée pour revenir à la largeur par défaut. Les largeurs choisies sont enregistrées avec le projet.</p>
            </section>

            <section className="help-section">
                <h4>Conditions de micro-régulation</h4>
                <p>Permet de définir des actions spéciales sur le diagramme. Survolez une ligne pour mettre en surbrillance l'action correspondante dans le diagramme (et inversement).</p>
                <ul>
                    <li><strong>Adaptatif vertical :</strong> Zone d'adaptation du temps de vert (rectangle bleu). Utilisez Plage1/Plage2 pour définir les groupes concernés.</li>
                    <li><strong>Contrôle de flot :</strong> Communément utilisé dans les carrefours à sens giratoire pour contrôler certaines branches amont de l'entrée à favoriser. Affiche une barre intermittente jaune/gris de DEB à (DEB + Vert minimum), puis orange pour la durée de jaune, puis rouge jusqu'à FIN.</li>
                    <li><strong>Seconde lucarne :</strong> Deuxième phase de vert (vert foncé + orange). Crée une barre supplémentaire sur la ligne du groupe.</li>
                    <li><strong>Escamotage de phase :</strong> Phase pouvant être supprimée (rectangle gris transparent sur toute la hauteur).</li>
                    <li><strong>Escamotage :</strong> Escamotage lié à un groupe spécifique. Définissez GF (source) et Action GF 1 (cible) pour afficher les flèches de dépendance. Si les valeurs Déb et Fin sont renseignées, le rectangle hachuré est positionné sur cette plage au lieu de la phase verte par défaut du groupe, ce qui permet de cibler une seconde lucarne.</li>
                    <li><strong>Ouverture anticipée :</strong> Anticipation du passage au vert (barre hachurée verte).</li>
                    <li><strong>Fermeture anticipée :</strong> Anticipation du passage au rouge (accolade orange sous la barre). En ajoutant un ou plusieurs groupes de feux dans Action GF, on réalise de fait des glissements.</li>
                    <li><strong>Signal aide conduite :</strong> Signal d'information conducteur (orange clignotant + bleu fixe).</li>
                    <li><strong>Début/Fin de bande passante :</strong> Ligne discontinue affichant la synchronisation à l'ouverture ou à la fermeture entre 2 groupes de feu.</li>
                    <li><strong>Priorité piétons :</strong> Action pour la priorité aux piétons.</li>
                    <li><strong>Instant Co :</strong> Point de synchronisation dans le cycle. Si Plage 1/2 non renseignées, s'applique à tous les groupes.</li>
                    <li><strong>Point de repos :</strong> Point de repos dans le cycle. Si Plage 1/2 non renseignées, s'applique à tous les groupes.</li>
                    <li><strong>Synchro BTS :</strong> Synchronisation avec le système BTS. Si Plage 1/2 non renseignées, s'applique à tous les groupes.</li>
                </ul>

                <h5 style={{ marginTop: '20px', marginBottom: '10px', color: '#aaa' }}>Légende des symboles</h5>
                <div className="legend-container" style={{ gap: '8px' }}>
                    <div className="legend-item">
                        <div className="legend-preview legend-adaptatif"></div>
                        <span>Adaptatif vertical</span>
                    </div>
                    <div className="legend-item">
                        <div className="legend-preview legend-controle-flot">
                            <div className="legend-cf-intermittent"></div>
                            <div className="legend-cf-orange"></div>
                            <div className="legend-cf-red"></div>
                        </div>
                        <span>Contrôle de flot</span>
                    </div>
                    <div className="legend-item">
                        <div className="legend-preview legend-bande-debut">
                            <svg viewBox="0 0 80 20" preserveAspectRatio="none">
                                <line x1="5" y1="2" x2="58" y2="16" stroke="#00cc00" strokeWidth="0.8" strokeDasharray="4,3" />
                                <path d="M58,16 L68,18 L62,10 Z" fill="#00cc00" />
                            </svg>
                        </div>
                        <span>Début de bande passante</span>
                    </div>
                    <div className="legend-item">
                        <div className="legend-preview legend-escamotage-group">
                            <svg viewBox="0 0 80 20" preserveAspectRatio="none">
                                <defs>
                                    <pattern id="help-escam-hatch" patternUnits="userSpaceOnUse" width="4" height="4" patternTransform="rotate(-45)">
                                        <line x1="0" y1="0" x2="0" y2="4" stroke="#1565C0" strokeWidth="2" />
                                    </pattern>
                                </defs>
                                <rect x="20" y="5" width="40" height="10" fill="url(#help-escam-hatch)" stroke="#1565C0" strokeWidth="0.5" strokeDasharray="2,2" />
                                <line x1="5" y1="3" x2="20" y2="10" stroke="#1565C0" strokeWidth="0.8" strokeDasharray="3,2" />
                                <line x1="75" y1="3" x2="60" y2="10" stroke="#1565C0" strokeWidth="0.8" strokeDasharray="3,2" />
                            </svg>
                        </div>
                        <span>Escamotage</span>
                    </div>
                    <div className="legend-item">
                        <div className="legend-preview legend-escamotage"></div>
                        <span>Escamotage de phase</span>
                    </div>
                    <div className="legend-item">
                        <div className="legend-preview legend-fermeture">
                            <span className="brace-point"></span>
                        </div>
                        <span>Fermeture anticipée</span>
                    </div>
                    <div className="legend-item">
                        <div className="legend-preview legend-bande-fin">
                            <svg viewBox="0 0 80 20" preserveAspectRatio="none">
                                <line x1="5" y1="2" x2="58" y2="16" stroke="#00cc00" strokeWidth="0.8" strokeDasharray="4,3" />
                                <path d="M58,16 L68,18 L62,10 Z" fill="#00cc00" />
                            </svg>
                        </div>
                        <span>Fin de bande passante</span>
                    </div>
                    <div className="legend-item">
                        <div className="legend-preview legend-instant-co"></div>
                        <span>Instant Co</span>
                    </div>
                    <div className="legend-item">
                        <div className="legend-preview legend-ouverture"></div>
                        <span>Ouverture anticipée</span>
                    </div>
                    <div className="legend-item">
                        <div className="legend-preview legend-point-repos"></div>
                        <span>Point de repos</span>
                    </div>
                    <div className="legend-item">
                        <div className="legend-preview legend-priorite-pietons"></div>
                        <span>Priorité piétons</span>
                    </div>
                    <div className="legend-item">
                        <div className="legend-preview legend-lucarne"></div>
                        <span>Seconde lucarne</span>
                    </div>
                    <div className="legend-item">
                        <div className="legend-preview legend-signa">
                            <div className="legend-signa-orange"></div>
                            <div className="legend-signa-blue"></div>
                        </div>
                        <span>Signal aide conduite</span>
                    </div>
                    <div className="legend-item">
                        <div className="legend-preview legend-synchro-bts"></div>
                        <span>Synchro BTS</span>
                    </div>
                </div>
            </section>

            <section className="help-section">
                <h4>Détection des conflits</h4>
                <p>L'application détecte automatiquement les conflits entre groupes antagonistes :</p>
                <ul>
                    <li><strong>Dégagement insuffisant :</strong> Le temps entre la fin du vert d'un groupe et le début du vert d'un autre est inférieur au temps requis dans la matrice.</li>
                    <li><strong>Chevauchement des phases vertes :</strong> Deux groupes antagonistes ont leurs phases vertes qui se chevauchent.</li>
                    <li><strong>Seconde lucarne chevauche vert :</strong> Une seconde lucarne chevauche la phase verte d'un groupe antagoniste.</li>
                    <li><strong>Chevauchement des secondes lucarnes :</strong> Deux secondes lucarnes de groupes antagonistes se chevauchent.</li>
                </ul>
                <p><em>Note : Les conflits de chevauchement sont automatiquement ignorés lorsqu'un Escamotage ou Escamotage de phase est défini entre les deux groupes concernés.</em></p>
            </section>

            <section className="help-section">
                <h4>Manipulation du diagramme</h4>
                <ul>
                    <li><strong>Glisser-déposer :</strong> Déplacez les barres du diagramme avec la souris (bords gauche/droit pour redimensionner)</li>
                    <li><strong>Actions glissables :</strong> Les overlays d'actions peuvent aussi être redimensionnés par glisser-déposer</li>
                    <li><strong>Zoom :</strong> Utilisez le curseur dans l'en-tête</li>
                    <li><strong>Dépendances :</strong> Affichez les flèches de dégagement avec le bouton "Dépendance"</li>
                    <li><strong>Surbrillance :</strong> Survolez une action dans le tableau ou le diagramme pour la mettre en évidence</li>
                </ul>
            </section>

            <section className="help-section">
                <h4>Menu Diagramme</h4>
                <ul>
                    <li><strong>Dupliquer :</strong> Crée un nouvel onglet PF avec une copie du diagramme actuel</li>
                    <li><strong>Glisser :</strong> Décale tous les groupes d'un nombre de secondes donné</li>
                    <li><strong>Insérer :</strong> Insère du temps dans le cycle à une position donnée</li>
                    <li><strong>Réduire :</strong> Réduit la plage de temps dans le cycle à une position donnée</li>
                    <li><strong>Déplacer un groupe :</strong> Déplace un groupe vers une nouvelle position. <em>Cette action synchronise automatiquement les données (diagramme, matrice, actions, données de trafic) dans tous les plans de feux.</em> La fenêtre reste ouverte après chaque déplacement pour enchaîner plusieurs opérations ; seuls la croix ou le bouton Annuler la ferment.</li>
                    <li><strong>Intégrer un bi-Carrefour :</strong> Permet de séparer visuellement le carrefour en deux zones en désignant un groupe de feu de séparation. Une ligne blanche horizontale et verticale apparaît dans la matrice des temps interverts (onglet Configuration et onglet Matrice), ainsi qu'une ligne blanche de séparation dans le diagramme du plan de feu. Le menu bascule ensuite en « Rétablir en uni-carrefour » pour supprimer la séparation. Cette option est sauvegardée avec le projet.</li>
                    <li><strong>Options :</strong> Affiche la légende visuelle des actions</li>
                </ul>
            </section>

            <section className="help-section">
                <h4>Image du carrefour</h4>
                <p><strong>Charger un fond de plan :</strong> Cliquez sur le bouton de chargement dans la zone Image du carrefour pour sélectionner un fichier. Les formats acceptés sont les principaux formats web reconnus par votre navigateur :</p>
                <ul>
                    <li><strong>JPEG</strong> (.jpg, .jpeg) — recommandé pour les <em>photos aériennes</em> (Géoportail, Google Maps, cadastre, IGN, drones…) et les captures d'écran de logiciels CAO</li>
                    <li><strong>PNG</strong> (.png) — recommandé pour les <em>plans au trait, schémas, captures nettes</em> avec fond transparent ou blanc</li>
                    <li><strong>SVG</strong> (.svg) — vectoriel, idéal pour les <em>schémas exportés depuis AutoCAD, Illustrator</em> ou autres outils vectoriels (reste net à tout zoom)</li>
                    <li><strong>WebP, GIF, BMP, AVIF</strong> — également acceptés (formats web courants)</li>
                </ul>
                <p><strong>Optimisation automatique :</strong> à l'import, l'image est automatiquement redimensionnée et ré-encodée en WebP pour alléger le projet, sans dégrader la lisibilité du fond de plan. Un message en bas à droite confirme le gain obtenu (par exemple « 848 Ko → 279 Ko »). Les images <strong>SVG</strong> (vectorielles) sont conservées telles quelles. L'optimisation a lieu une seule fois, à l'import : l'image n'est pas re-compressée ensuite. Elle reste embarquée en base64 dans le projet sauvegardé ; l'image source sur votre disque n'est jamais modifiée.</p>
                <p>Note sur les formats non supportés : les fichiers <strong>TIFF / GeoTIFF</strong> (.tif), <strong>HEIC</strong> (photos iPhone) et autres formats spécialisés ne sont pas affichés par les navigateurs. Convertissez-les au préalable en JPEG ou PNG (la plupart des visionneuses d'images, ou un export depuis un SIG, savent le faire).</p>

                <p>Une fois l'image chargée, elle affiche les flèches des groupes de feux avec un code couleur dynamique :</p>
                <ul>
                    <li><strong>Survol du diagramme :</strong> En survolant le diagramme, les flèches changent de couleur selon la phase à l'instant survolé :
                        <ul>
                            <li><span style={{color: '#00cc00'}}>Vert</span> : Phase verte normale</li>
                            <li><span style={{color: '#00aa00'}}>Vert foncé</span> : Seconde lucarne active</li>
                            <li><span style={{color: '#ff9900'}}>Orange</span> : Phase orange/jaune</li>
                            <li><span style={{color: '#cc0000'}}>Rouge</span> : Phase rouge</li>
                        </ul>
                    </li>
                    <li><strong>Mode simulation :</strong> Les flèches suivent le temps de la simulation en cours</li>
                    <li><strong>Escamotage :</strong> Quand un escamotage est actif, la flèche du groupe cible passe à l'orange puis au rouge pendant la zone de coupure</li>
                    <li><strong>Déplacement au clavier :</strong> Sélectionnez une flèche en cliquant dessus, puis utilisez les touches fléchées du clavier (gauche, droite, haut, bas) pour la déplacer point par point. Le focus doit être sur l'image du carrefour (ne fonctionne pas quand l'image est détachée).</li>
                    <li><strong>Glisser-déposer :</strong> Cliquez et maintenez sur une flèche pour la déplacer. La flèche suit le mouvement de la souris sans se recentrer sur le point de clic.</li>
                </ul>
            </section>

            <section className="help-section">
                <h4>Raccourcis clavier</h4>
                <ul>
                    <li><strong>Ctrl+Z :</strong> Annuler la dernière action</li>
                    <li><strong>Ctrl+Y :</strong> Refaire la dernière action annulée</li>
                    <li><strong>Flèches directionnelles :</strong> Déplacent point par point la flèche sélectionnée sur l'image du carrefour (focus requis sur l'image)</li>
                </ul>
            </section>

            <section className="help-section">
                <h4>Commentaires</h4>
                <p>Le champ <strong>Commentaire</strong> est associé à chaque <em>groupe de feu</em>. Il permet d'annoter individuellement une ligne du diagramme avec une information libre (par exemple une remarque technique, un rappel de configuration, un point à valider avec le maître d'ouvrage). Chaque groupe de feu possède son propre commentaire, qui reste affiché sur sa ligne dans le diagramme. Les commentaires sont sauvegardés avec le projet et sont communs à tous les plans de feux (une même annotation reste valable pour tous les PF d'un groupe de feu donné).</p>
                <ul>
                    <li><strong>Coloration du texte :</strong> Sélectionnez du texte puis appuyez sur <span style={{color: '#4CAF50'}}>+</span> (vert) ou <span style={{color: '#F44336'}}>−</span> (rouge).</li>
                    <li><strong>Coloration de toute la ligne :</strong> Sans sélection, <span style={{color: '#4CAF50'}}>+</span> ou <span style={{color: '#F44336'}}>−</span> colore tout le contenu.</li>
                    <li><strong>Basculer en blanc :</strong> Si une ligne entière est déjà colorée, appuyez à nouveau sur <span style={{color: '#4CAF50'}}>+</span> ou <span style={{color: '#F44336'}}>−</span> pour retirer la couleur.</li>
                    <li><strong>Affichage :</strong> Les commentaires sont affichés dans la colonne dédiée du diagramme. L'option <em>Mise en page → Commentaires du diagramme</em> permet de les masquer globalement.</li>
                    <li><strong>Impression :</strong> Les commentaires figurent dans l'export du dossier complet.</li>
                </ul>
            </section>

            <section className="help-section">
                <h4>Remarques</h4>
                <p>Le champ <strong>Remarques</strong> est associé à chaque <em>plan de feu</em> (PF1, PF2, PF3...). Il permet de consigner des informations d'ensemble propres à un plan de feu : justification d'un choix de cycle, horaires d'activation, scénario de régulation, validation d'un comité, etc. Contrairement aux commentaires (par groupe), chaque plan de feu a ses propres remarques, indépendantes des autres PF. Changer d'onglet PF modifie le contenu affiché.</p>
                <ul>
                    <li><strong>Coloration du texte :</strong> Sélectionnez du texte puis appuyez sur <span style={{color: '#4CAF50'}}>+</span> (vert) ou <span style={{color: '#F44336'}}>−</span> (rouge).</li>
                    <li><strong>Taille du texte :</strong> Sélectionnez du texte puis appuyez sur <strong>▲</strong> (agrandir) ou <strong>▼</strong> (réduire). Utile pour hiérarchiser les informations (titre plus grand, détails plus petits).</li>
                    <li><strong>Mise en forme conservée :</strong> Si vous collez depuis un traitement de texte (Word, LibreOffice...), la mise en forme (taille de police, couleurs) est préservée.</li>
                    <li><strong>Affichage :</strong> Les remarques sont affichées dans une zone dédiée à droite du diagramme. L'option <em>Mise en page → Remarques du diagramme</em> permet de les masquer globalement.</li>
                    <li><strong>Impression :</strong> Les remarques du PF actif figurent dans l'export du dossier complet.</li>
                </ul>
            </section>

            <section id="help-trafic" className="help-section">
                <h4>Données Trafic</h4>
                <p>L'onglet Trafic permet de saisir les données de trafic par groupe :</p>
                <ul>
                    <li><strong>Coef :</strong> Coefficient de voie correspondant aux courants de circulation du groupe de feu (partagé entre tous les jeux de données)</li>
                    <li><strong>Trafic :</strong> Volume de trafic (véh/h) - spécifique à chaque jeu de données. Appuyez sur la touche <em>c</em> pour indiquer un trafic coordonné : un petit "c" apparaît à côté de la valeur et les colonnes Retard et File d'attente sont mises à 0. Appuyez à nouveau sur <em>c</em> pour retirer la coordination.</li>
                    <li><strong>V.Utile :</strong> Durée de vert nécessaire pour passer le trafic. Formule = Trafic / (1800 × Coef / Cycle)</li>
                    <li><strong>Cap.U :</strong> Capacité utilisée pour passer le trafic affecté au groupe de feu. Formule = (V.Utile / Vert total) × 100%</li>
                    <li><strong>Retard :</strong> Temps d'attente théorique moyen en pied de feu hors saturation. Formule = (Cycle - Vert total)² / (2 × Cycle × (1 - Trafic / (1800 × Coef))). <em>Si une action "Début de bande passante" cible ce groupe (Action GF), alors Retard = max(0, Début de vert - Fin de l'action).</em></li>
                    <li><strong>File d'attente :</strong> File d'attente théorique maximale hors saturation. Formule = (partie entière de (Trafic × (Cycle - Vert total) / 3600 / Coef) + 1) × 6 mètres. <em>Si une action "Début de bande passante" cible ce groupe (Action GF), alors File d'attente = max(0, Début de vert - Fin de l'action).</em></li>
                    <li><strong>Vert total :</strong> Les calculs de Cap.U, Retard et File d'attente prennent en compte le temps de vert principal + la durée des secondes lucarnes du groupe.</li>
                </ul>
                <p><strong>Surbrillance interactive :</strong> Le survol des champs Coef, Trafic, V.Utile, Cap.U, Retard ou File d'attente met en surbrillance la barre correspondante dans le diagramme.</p>
                <p><strong>Jeux de données :</strong> La listbox "Associé à" permet de basculer entre plusieurs jeux de données trafic (HPM, HPS, etc.). Chaque jeu de données conserve ses propres valeurs de trafic.</p>
                <p><strong>Jeux de données personnalisés :</strong> Survolez le sélecteur "Associé à" et appuyez sur la touche <em>+</em> pour créer un nouveau jeu de données personnalisé (17 caractères max). Le nom est prérempli à partir du jeu actif. Les jeux personnalisés sont sauvegardés dans le projet et dans le stockage local.</p>
                <p><strong>Association PF / jeu de données :</strong> Chaque onglet PF mémorise le jeu de données trafic sélectionné. Lorsque vous changez d'onglet PF, le jeu de données associé est automatiquement restauré. Cette association est sauvegardée dans le projet.</p>
                <p><strong>Bouton Coller :</strong> Si le jeu de données sélectionné est vide, un bouton "Coller..." apparaît pour copier les données depuis un autre jeu de données.</p>
                <p><strong>Code couleur Cap.U :</strong></p>
                <ul>
                    <li><span style={{color: '#4caf50'}}>Vert</span> : &lt; 76% (fluide)</li>
                    <li><span style={{color: '#ff9800'}}>Orange</span> : 76-85% (chargé)</li>
                    <li><span style={{color: '#f44336'}}>Rouge</span> : 86-100% (saturé)</li>
                    <li><span style={{color: '#000', background: '#ff6b6b', padding: '0 4px'}}>Noir/Rouge</span> : &gt; 100% (sursaturé)</li>
                </ul>
            </section>

            <section className="help-section">
                <h4>Simulation</h4>
                <p>L'onglet Simulation permet de tester l'effet des actions de micro-régulation sur le diagramme.</p>
                <ul>
                    <li><strong>Actions cochables :</strong> Chaque action définie dans les conditions de micro-régulation peut être cochée individuellement. Le diagramme se met à jour en temps réel pour visualiser l'effet combiné des actions sélectionnées.</li>
                    <li><strong>Ordre de traitement :</strong> Les actions sont traitées dans l'ordre suivant : Point de repos → Ouverture anticipée → Fermeture anticipée → Escamotage (groupe) → Adaptatif vertical → Escamotage de phase. Chaque action s'applique sur le diagramme virtuel résultant des actions précédentes.</li>
                    <li><strong>Contractions cumulatives :</strong> L'Adaptatif vertical et l'Escamotage de phase contractent le diagramme. Les contractions s'ajustent aux contractions précédentes pour éviter les doubles déductions.</li>
                    <li><strong>Point de repos :</strong> Cocher un Point de repos à l'instant <em>t</em> fige le cycle pendant 10 secondes : la durée du cycle s'allonge de 10 s, les groupes dont le vert traverse <em>t</em> sont étirés (ils restent verts pendant le freeze), les actions et groupes situés après <em>t</em> sont décalés vers la droite. Plusieurs Points de repos sont cumulables. Un Point de repos est automatiquement <em>inhibé</em> s'il tombe à l'intérieur d'une zone Adaptatif vertical ou Escamotage de phase sélectionnée. Visuellement, une bande grise hachurée libellée « Repos » signale l'emplacement de chaque Point de repos sur la timeline.</li>
                    <li><strong>Fermeture anticipée et Action GF (ou glissements) :</strong> Lorsqu'une fermeture anticipée pointe sur la fin du vert d'un groupe cible (Action GF), la fin de ce vert est réduite. Si elle pointe sur le début, le début est avancé — on parle alors de <em>glissement</em>. La durée effective tient compte du chevauchement avec les zones AV/EP.</li>
                    <li><strong>Champs DA, Déb, Fin verrouillés :</strong> Lors d'une simulation active, les champs DA, Déb et Fin de la sidebar du diagramme sont désactivés (grisés, non cliquables). Les valeurs affichées sont calculées par la simulation et ne reflètent plus une saisie utilisateur — les modifier n'aurait pas de sens. La désactivation est levée dès qu'aucune action n'est cochée dans le panneau Simulation.</li>
                    <li><strong>Actions grisées :</strong> Les actions dont la plage [Déb, Fin] tombe entièrement dans une zone supprimée (AV ou EP) sont affichées en grisé dans la liste.</li>
                    <li><strong>Conflits simulés :</strong> Le tableau des conflits se met à jour selon les temps de vert simulés. Les groupes réduits à un vert nul sont exclus des conflits. Le survol d'un conflit affiche une flèche rouge pointillée dans le diagramme depuis les positions simulées.</li>
                    <li><strong>Données trafic :</strong> Les données V.Utile, Cap.U, Retard et File d'attente sont toujours affichées. Les valeurs inhibées par les actions cochées apparaissent en grisé.</li>
                    <li><strong>Tout cocher / Tout décocher :</strong> Permet de sélectionner ou désélectionner rapidement toutes les actions.</li>
                </ul>
            </section>

            <section className="help-section">
                <h4>Authentification</h4>
                <p>L'application nécessite une connexion pour accéder aux fonctionnalités :</p>
                <ul>
                    <li><strong>Premier utilisateur :</strong> Le premier compte créé devient automatiquement administrateur</li>
                    <li><strong>Niveaux de permissions :</strong></li>
                    <ul>
                        <li><em>Lecture seule :</em> Consultation uniquement (ouvrir, imprimer, onde verte)</li>
                        <li><em>Modification partielle :</em> Ouvrir, enregistrer, importer Excel, imprimer, dupliquer</li>
                        <li><em>Modification totale :</em> Toutes les fonctionnalités + gestion des utilisateurs</li>
                    </ul>
                    <li><strong>Gestion des utilisateurs :</strong> Menu "Utilisateurs" (admin uniquement) pour créer, modifier ou supprimer des comptes</li>
                    <li><strong>Import/Export :</strong> Possibilité d'exporter et importer la liste des utilisateurs en JSON</li>
                </ul>
            </section>

            <section className="help-section">
                <h4>Sauvegarde et projets</h4>
                <ul>
                    <li><strong>Sauvegarde automatique :</strong> Les données sont sauvegardées automatiquement dans le navigateur (local storage)</li>
                    <li><strong>Nouveau projet :</strong> Menu Fichier → Nouveau projet réinitialise l'application (actif uniquement si le projet a été modifié)</li>
                    <li><strong>Ouvrir un projet :</strong> Menu Fichier → Ouvrir un projet permet de charger un fichier JSON depuis le disque. Les répertoires récents sont proposés en sous-menu.</li>
                    <li><strong>Ouvrir depuis le local storage :</strong> Menu Fichier → Ouvrir depuis le local storage permet de charger un projet précédemment sauvegardé dans le navigateur</li>
                    <li><strong>Sauvegarder :</strong> Menu Fichier → Sauvegarder exporte le projet au format JSON sur le disque. Les répertoires récents sont proposés en sous-menu.</li>
                    <li><strong>Importer Excel :</strong> Menu Fichier → Importer Excel charge les données depuis un fichier Excel (.xlsx). Les répertoires récents sont proposés en sous-menu.</li>
                </ul>
                <h5 style={{ marginTop: '15px', marginBottom: '10px', color: '#aaa' }}>Sécurité de la sauvegarde</h5>
                <p>L'application inclut des protections contre la perte de données :</p>
                <ul>
                    <li><strong>Validation des données :</strong> La sauvegarde est refusée si les groupes, plans de feux ou matrice de conflits sont vides</li>
                    <li><strong>Détection de corruption :</strong> Alerte si les données à sauvegarder semblent anormalement petites</li>
                    <li><strong>Backup automatique :</strong> Une copie de secours est créée avant d'écraser une sauvegarde existante</li>
                    <li><strong>Confirmation de sécurité :</strong> Demande de confirmation si la nouvelle sauvegarde est significativement plus petite que l'ancienne</li>
                    <li><strong>Gestion des erreurs :</strong> Messages d'erreur explicites en cas de problème (espace insuffisant, données invalides)</li>
                </ul>
            </section>

            <section className="help-section">
                <h4>Interopérabilité</h4>
                <p>Menu Fichier → <strong>Interopérabilité…</strong> — axe d'évolution envisagé pour échanger des données de programmation de carrefours à feux avec d'autres systèmes, qu'ils soient propriétaires ou ouverts.</p>
                <p>L'objectif à terme est de faciliter la reprise et la restitution de plans de feux entre TraCflux et les principaux environnements du marché, afin d'éviter les ressaisies et de fluidifier le travail des traficiens. Cette capacité d'interopérabilité constitue un potentiel important de l'outil et un levier d'ouverture vers l'écosystème existant.</p>
                <p><em>Cette fonctionnalité n'est pas opérationnelle dans la présente version : elle est présentée à titre d'orientation produit.</em></p>
            </section>

            <section className="help-section">
                <h4>Liens externes</h4>
                <p>Menu Fichier → Liens externes permet de créer des raccourcis vers des fichiers ou URLs associés au projet :</p>
                <ul>
                    <li><strong>Ajouter un lien :</strong> Renseignez un nom et un chemin (fichier local ou URL)</li>
                    <li><strong>Format du chemin :</strong>
                        <ul>
                            <li>URL : <code>https://exemple.com</code></li>
                            <li>Fichier local : <code>C:\Documents\plan.pdf</code></li>
                        </ul>
                    </li>
                    <li><strong>Ouvrir un lien :</strong> Double-cliquez sur le lien pour l'ouvrir</li>
                    <li><strong>Fichiers PDF :</strong> S'ouvrent directement dans le navigateur (lecteur intégré)</li>
                    <li><strong>Sauvegarde :</strong> Les liens sont sauvegardés avec chaque projet (pas globalement)</li>
                </ul>
                <p><em>Note : Pour des raisons de sécurité, le navigateur ne peut pas lancer d'applications externes (Word, Excel). Ces fichiers seront proposés en téléchargement.</em></p>
            </section>

            <section className="help-section">
                <h4>Impression du dossier</h4>
                <p>Le menu Fichier → <strong>Imprimer le dossier...</strong> ouvre un dialog de sélection des sections à inclure dans le dossier imprimé (format A4 paysage).</p>
                <h5 style={{ marginTop: '12px', marginBottom: '8px', color: '#aaa' }}>Sélection des sections</h5>
                <p>Le dialog présente des cases à cocher organisées en deux niveaux :</p>
                <ul>
                    <li><strong>Sections globales</strong> (niveau principal) :
                        <ul>
                            <li><em>Image du carrefour :</em> Photo ou schéma du carrefour avec les flèches des groupes de feux</li>
                            <li><em>Numéros de GF :</em> Affiche les numéros des groupes de feux sur l'image (option disponible si l'image contient des flèches)</li>
                            <li><em>Formulaire :</em> Tableau des groupes avec leurs paramètres (type, courant, durées)</li>
                            <li><em>Matrice de sécurité :</em> Matrice globale des temps de dégagement entre groupes de feux, tous plans de feux confondus</li>
                            <li><em>Matrice des temps interverts :</em> Matrice de dégagement entre groupes conflictuels pour le plan de feu actif</li>
                        </ul>
                    </li>
                    <li><strong>Sections par plan de feu</strong> (une ligne par PF) :
                        <ul>
                            <li>Chaque plan de feu dispose de sa propre case à cocher</li>
                            <li>Les PF validés sont signalés en vert et cochés par défaut ; les autres sont décochés</li>
                            <li>Cocher/décocher un PF active/désactive automatiquement ses sous-options</li>
                        </ul>
                    </li>
                    <li><strong>Sous-options par PF</strong> (indentées sous chaque PF) :
                        <ul>
                            <li><em>Conditions de micro-régulation :</em> Tableau des actions de micro-régulation du PF</li>
                            <li><em>Variables micro :</em> Variables personnalisées de micro-régulation du PF</li>
                            <li><em>Phasage bulle :</em> Représentation graphique des phases du PF sous forme de bulles sur l'image du carrefour (disponible si l'image et les flèches existent)</li>
                            <li><em>Données de trafic et capacité :</em> Tableau des données trafic associées au PF</li>
                        </ul>
                    </li>
                </ul>
                <h5 style={{ marginTop: '12px', marginBottom: '8px', color: '#aaa' }}>Organisation du document imprimé</h5>
                <p>Le dossier est structuré comme suit :</p>
                <ul>
                    <li><strong>Page de titre :</strong> Nom du carrefour</li>
                    <li><strong>Sections globales :</strong> Image du carrefour, formulaire, matrice de sécurité et matrice des temps interverts (si cochées)</li>
                    <li><strong>Pour chaque PF coché :</strong> Diagramme du plan de feu, suivi de ses conditions de micro-régulation, variables micro, phasage bulle et données de trafic/capacité (selon les sous-options cochées)</li>
                    <li><strong>Pied de page :</strong> Nom du fichier projet et date d'impression sur chaque page</li>
                </ul>
                <h5 style={{ marginTop: '12px', marginBottom: '8px', color: '#aaa' }}>Paramètres d'impression recommandés</h5>
                <ul>
                    <li><strong>Couleur :</strong> Sélectionnez "Couleur" pour imprimer les barres du diagramme en couleur</li>
                    <li><strong>Marges :</strong> Sélectionnez "Minimum" ou "Aucune" pour maximiser l'espace</li>
                    <li><strong>Graphiques d'arrière-plan :</strong> Activez cette option pour imprimer les couleurs des barres de phase et le quadrillage</li>
                </ul>
            </section>

            <section className="help-section">
                <h4>Export en PNG</h4>
                <p>Le menu Fichier → <strong>Exporter en PNG...</strong> propose un sous-menu permettant de capturer indépendamment sept vues de l'application :</p>
                <ul>
                    <li><strong>Formulaire :</strong> le tableau des groupes (nom, type, courant, durées, vert minimum) tel qu'affiché dans l'onglet Configuration</li>
                    <li><strong>Diagramme :</strong> le diagramme temporel du plan de feu actif (sans les fenêtres latérales commentaires/remarques, qui sont masquées dans le PNG)</li>
                    <li><strong>Matrice interverts :</strong> la matrice des temps de dégagement, dans son intégralité (l'export ne dépend pas de la zone visible à l'écran si la matrice est plus large que la fenêtre)</li>
                    <li><strong>Conditions de micro-régulation :</strong> le tableau des actions du plan de feu actif</li>
                    <li><strong>Image du carrefour :</strong> la zone d'image seule, sans le bandeau de titre et sans les contrôles d'édition</li>
                    <li><strong>Capacité utilisée :</strong> le tableau de capacité avec un titre formaté « Capacité utilisée par groupe de feu — Diagramme &lt;PF&gt; / avec le trafic &lt;jeu actif&gt; » (en lieu et place du header d'édition normalement affiché)</li>
                    <li><strong>Phasage bulle :</strong> la représentation circulaire des phases du PF actif</li>
                </ul>
                <h5 style={{ marginTop: '12px', marginBottom: '8px', color: '#aaa' }}>Conditions d'activation</h5>
                <p>Chaque entrée du sous-menu est <strong>cliquable uniquement si la vue correspondante est actuellement affichée à l'écran</strong>. Sinon elle est grisée et un tooltip explique quoi activer. Par exemple, « Capacité utilisée » n'est cliquable qu'en étant sur l'onglet Trafic ; « Phasage bulle » n'est cliquable qu'en mode Phasage bulle ; etc.</p>
                <h5 style={{ marginTop: '12px', marginBottom: '8px', color: '#aaa' }}>Rendu du PNG</h5>
                <p>Quel que soit le thème actif dans l'application (Sombre, Sépia, Bleu nuit, etc.), <strong>le PNG est toujours généré en thème clair (noir sur fond blanc)</strong>. Justification : éviter les aplats de noir lors de l'impression sur papier (économie d'encre, lisibilité). La taille des polices est ajustée pour que le contenu rentre dans les colonnes proportionnelles d'origine.</p>
                <h5 style={{ marginTop: '12px', marginBottom: '8px', color: '#aaa' }}>Téléchargement et presse-papiers</h5>
                <p>Au clic, le PNG est <strong>simultanément</strong> :</p>
                <ul>
                    <li>📥 <strong>Téléchargé</strong> dans votre dossier Téléchargements (nom : <code>{`{Projet}_{PF}_{Vue}_{date}.png`}</code>)</li>
                    <li>📋 <strong>Copié dans le presse-papiers</strong> — un simple <kbd>Ctrl+V</kbd> dans Word, PowerPoint, un mail ou tout outil graphique colle directement l'image sans passer par le fichier</li>
                </ul>
                <p>Un toast de confirmation indique le nom du fichier et le statut du presse-papiers. Si la copie dans le presse-papiers échoue (Safari, contexte HTTP non sécurisé, autorisation refusée), le téléchargement reste opérationnel et le toast le signale.</p>
            </section>

            <section className="help-section">
                <h4>Import Excel</h4>
                <p>
                    L'application embarque un import Excel (<code>.xlsx</code>) capable de
                    charger en un seul geste la configuration complète d'un carrefour
                    (groupes, plans de feux, matrice de dégagement, données trafic).
                    Cet importeur est cependant <strong>conçu pour une structure de
                    fichier Excel précise</strong> — celle utilisée historiquement par
                    l'auteur pour ses propres projets. Il n'est pas exploitable tel
                    quel sur des fichiers Excel issus d'autres pratiques ou d'autres
                    outils : chaque organisation a ses propres conventions de feuilles,
                    de colonnes et de nommage.
                </p>
                <p>
                    Un <strong>import sur mesure reste possible</strong>, à condition de
                    réaliser un <strong>développement spécifique</strong> fondé sur la
                    connaissance exacte de la structure du fichier source. Cette piste
                    devient pertinente lors d'un <strong>basculement de parc</strong>
                    vers TraCflux, lorsque le volume de projets à reprendre rend la
                    ressaisie manuelle peu réaliste.
                </p>
                <p>
                    Le canal recommandé est alors le dépôt GitHub du projet : une issue
                    décrivant le besoin (volume de projets concernés, exemple de fichier
                    anonymisé, format des feuilles) permet de discuter ou de contribuer
                    un développement <em>open source</em>. Le format <code>.json</code>
                    natif de TraCflux sert de structure cible — la valeur ajoutée d'un
                    parseur consiste uniquement à bien lire votre format Excel source.
                </p>
                <p>
                    <strong>Sécurité — fichiers d'origine externe :</strong> n'importer que des
                    fichiers <code>.xlsx</code> d'origine connue (vos propres feuilles ou celles
                    de collègues identifiés). La bibliothèque de lecture utilisée (<code>xlsx</code>
                    / SheetJS) comporte deux vulnérabilités connues sans correctif diffusé sur le
                    registre npm officiel. Un fichier malveillant ouvert via l'import pourrait
                    perturber l'onglet du navigateur. Dans l'usage local mono-utilisateur de
                    TraCflux, le risque est faible (vecteur de type phishing) et aucun risque ne
                    pèse sur le système d'exploitation. La FAQ et le README détaillent la situation.
                </p>
                <h5 style={{ marginTop: '14px', marginBottom: '8px', color: '#aaa' }}>Structure attendue par l'importeur fourni</h5>
                <p>À titre informatif (un exemple, non un standard) :</p>
                <ul>
                    <li><strong>Feuille Formulaire :</strong> Configuration des groupes (nom, type, durées)</li>
                    <li><strong>Feuille PF :</strong> Diagramme et matrice de dégagement pour chaque plan de feux</li>
                    <li><strong>Feuille Trafic :</strong> Données de trafic par groupe — une colonne <em>X</em> pour le coefficient de voie (Coef), une colonne <em>Y</em> pour un premier jeu de données (nom porté par une cellule d'en-tête dédiée), et éventuellement une colonne <em>Z</em> pour un second jeu.</li>
                </ul>
            </section>

            <h3 id="help-onde-verte" style={{ color: '#4ecdc4', borderBottom: '1px solid #4ecdc4', paddingBottom: '8px', marginTop: '32px', marginBottom: '16px' }}>Chapitre 2 — Onde verte</h3>

            <section className="help-section">
                <h4>Présentation</h4>
                <p>L'onde verte permet de coordonner les feux de signalisation le long d'un axe routier afin d'offrir aux usagers une progression fluide sans arrêt aux feux successifs.</p>
                <p>Directement connectée aux plans de feux de vos carrefours, l'onde verte se construit et se met à jour en temps réel : modifiez un offset, changez de plan de feu ou ajustez une vitesse, et le diagramme espace-temps se redessine instantanément. Chaque carrefour ajouté récupère automatiquement ses données depuis le projet sauvegardé, garantissant une cohérence permanente entre vos diagrammes de feux et la coordination d'axe. La synchronisation bidirectionnelle, le changement de plan de feu global ou individuel, et la visualisation immédiate des bandes passantes font de cet outil un véritable assistant pour optimiser la fluidité de vos axes routiers.</p>
            </section>

            <section className="help-section">
                <h4>Création d'une onde verte</h4>
                <ul>
                    <li><strong>Menu Fichier → Onde verte :</strong> Ouvre l'assistant de création</li>
                    <li><strong>Ajout de carrefours :</strong> Sélectionnez des projets sauvegardés et ajoutez-les à la liste (minimum 2 carrefours requis)</li>
                    <li><strong>Plan de feu :</strong> Pour chaque carrefour, choisissez le plan de feu (PF) à utiliser</li>
                    <li><strong>Groupes de feux :</strong> Assignez un groupe pour le sens montant (GF montant) et un pour le sens descendant (GF descendant)</li>
                    <li><strong>Distances :</strong> Renseignez la distance en mètres pour chaque sens. La distance du sens descendant est pré-remplie automatiquement (distance montant + 20 m)</li>
                </ul>
            </section>

            <section className="help-section">
                <h4>Interaction avec les plans de feux</h4>
                <p>L'onde verte est directement liée aux données des carrefours :</p>
                <ul>
                    <li><strong>Chargement des données :</strong> Les groupes, durées de vert, offsets et durées de cycle sont automatiquement extraits du plan de feu sélectionné pour chaque carrefour</li>
                    <li><strong>Changement de PF individuel :</strong> Dans le tableau des données saisies, modifiez le PF d'un carrefour pour voir instantanément l'effet sur le diagramme</li>
                    <li><strong>Changement de PF global :</strong> Le sélecteur en haut de page permet de basculer tous les carrefours sur un même plan de feu simultanément. Les paramètres (vitesses, offsets) sont sauvegardés et restaurés automatiquement pour chaque PF</li>
                    <li><strong>Synchronisation :</strong> Le bouton "Synchroniser" recharge les données de tous les carrefours depuis les projets sauvegardés, intégrant ainsi les modifications apportées aux diagrammes de feux</li>
                    <li><strong>Détection des conflits de cycle :</strong> Si un carrefour a un cycle différent des autres, sa ligne est surlignée en rouge dans le tableau</li>
                    <li><strong>Actions prises en compte :</strong> Les secondes lucarnes et ouvertures anticipées définies dans les conditions de micro-régulation sont affichées sur le diagramme de l'onde verte</li>
                </ul>
            </section>

            <section className="help-section">
                <h4>Diagramme espace-temps</h4>
                <p>Le diagramme représente les phases de vert de chaque carrefour en fonction du temps (axe horizontal) et de la distance (axe vertical) :</p>
                <ul>
                    <li><strong>Barres vertes :</strong> Phases de vert du groupe montant, positionnées à la distance du GF montant</li>
                    <li><strong>Barres orange :</strong> Phases de vert du groupe descendant, positionnées à la distance du GF descendant</li>
                    <li><strong>Lignes de vitesse (tirets) :</strong> Représentent la progression des véhicules :
                        <ul>
                            <li><span style={{color: '#4CAF50'}}>Vert</span> : Sens montant (bas vers haut)</li>
                            <li><span style={{color: '#FF9800'}}>Orange</span> : Sens descendant (haut vers bas)</li>
                        </ul>
                    </li>
                    <li><strong>Bandes passantes :</strong> Zones colorées semi-transparentes montrant la fenêtre temporelle où les véhicules peuvent traverser tous les carrefours sans s'arrêter. La largeur en secondes est affichée dans la légende</li>
                    <li><strong>Affichage multi-cycles :</strong> Choisissez d'afficher 2 ou 3 cycles pour une meilleure visibilité de la coordination</li>
                </ul>
            </section>

            <section className="help-section">
                <h4>Contrôles interactifs</h4>
                <ul>
                    <li><strong>Vitesses :</strong> Ajustez les vitesses montante et descendante (10 à 130 km/h) pour modifier l'inclinaison des lignes de vitesse et le calcul des bandes passantes</li>
                    <li><strong>Glisser les lignes de vitesse :</strong> Cliquez et glissez horizontalement une ligne de vitesse pour ajuster l'offset en secondes. L'épaisseur de la ligne augmente pendant le glissement</li>
                    <li><strong>Zoom X :</strong> Curseur de 3 à 20 pixels/seconde pour ajuster l'échelle temporelle</li>
                    <li><strong>Zoom Y :</strong> Curseur de 0.5 à 3 pixels/mètre pour ajuster l'échelle des distances</li>
                    <li><strong>Lignes de vitesse :</strong> Case à cocher pour afficher ou masquer les lignes guides</li>
                </ul>
            </section>

            <section className="help-section">
                <h4>Tableau des données saisies</h4>
                <ul>
                    <li><strong>Ordre :</strong> Réorganisez les carrefours avec les boutons ↑ et ↓</li>
                    <li><strong>Carrefour :</strong> Nom du projet (lecture seule, issu du projet sauvegardé)</li>
                    <li><strong>PF :</strong> Sélection individuelle du plan de feu pour chaque carrefour</li>
                    <li><strong>Cycle :</strong> Durée du cycle (surligné en rouge si différent du cycle de référence, c'est-à-dire du cycle le plus fréquent)</li>
                    <li><strong>GF Montant :</strong> Groupe de feux et distance (en mètres) pour le sens montant</li>
                    <li><strong>GF Descendant :</strong> Groupe de feux et distance (en mètres) pour le sens descendant</li>
                    <li><strong>Ajouter :</strong> Le bouton "+" permet d'ajouter de nouveaux carrefours à la liste</li>
                </ul>
            </section>

            <section className="help-section">
                <h4>Barre d'outils</h4>
                <ul>
                    <li><strong>V. mont / V. desc :</strong> Vitesses montante et descendante en km/h (de 10 à 130). Déterminent l'inclinaison des lignes directrices et le calcul de la bande passante.</li>
                    <li><strong>Zoom X :</strong> Échelle horizontale du diagramme (en px/s)</li>
                    <li><strong>Zoom Y :</strong> Échelle verticale du diagramme (en px/m)</li>
                    <li><strong>Cycles :</strong> Nombre de cycles affichés (2 ou 3)</li>
                    <li><strong>Lignes directrices :</strong> Affiche ou masque les lignes de vitesse diagonales sur le diagramme</li>
                    <li><strong>Synchroniser :</strong> Actualise les données (offset, durée de vert, cycle) depuis les projets sauvegardés pour le plan de feu sélectionné de chaque carrefour</li>
                    <li><strong>Enregistrer :</strong> Exporte l'onde verte dans un fichier JSON sur le disque</li>
                    <li><strong>Imprimer :</strong> Génère une version imprimable du diagramme en format A4 paysage avec légende, vitesses et bandes passantes</li>
                </ul>
            </section>
            <section className="help-section">
                <h4>Sauvegarde et chargement</h4>
                <ul>
                    <li><strong>Création :</strong> Menu Onde verte → Créer une onde verte crée une nouvelle onde verte et l'ouvre dans un nouvel onglet</li>
                    <li><strong>Ouverture :</strong> Menu Onde verte → Ouvrir une onde verte charge une onde verte existante depuis le local storage</li>
                    <li><strong>Paramètres par PF :</strong> Les vitesses, offsets et options d'affichage sont sauvegardés séparément pour chaque plan de feu, permettant de comparer facilement différents scénarios</li>
                </ul>
            </section>

            <h3 style={{ color: '#4ecdc4', borderBottom: '1px solid #4ecdc4', paddingBottom: '8px', marginTop: '32px', marginBottom: '16px' }}>Glossaire</h3>
            <section className="help-section">
                <h4>Glossaire</h4>
                <dl style={{ margin: 0 }}>
                    <dt><strong>Adaptatif vertical</strong></dt>
                    <dd>Action de micro-régulation qui décale verticalement l'ensemble des groupes de feux à une période donnée du cycle, pour créer une contraction ou une dilatation temporaire des phases.</dd>

                    <dt><strong>A vert (AVert)</strong></dt>
                    <dd>« Avant vert » — variable indiquant le temps résiduel avant l'apparition du vert d'un groupe. Utilisée dans les conditions de micro-régulation pour déclencher une action juste avant l'ouverture d'un feu.</dd>

                    <dt><strong>Bande passante (début / fin)</strong></dt>
                    <dd>Actions de micro-régulation qui marquent les bornes de progression d'un véhicule d'un feu à l'autre sur un axe. Représentées dans le diagramme par des flèches vertes en pointillé.</dd>

                    <dt><strong>Coefficient de voie</strong></dt>
                    <dd>Pondération appliquée au débit de saturation théorique d'une voie pour refléter les particularités locales (pente, tourne-à-gauche, largeur, etc.). Utilisé dans les calculs de capacité et de taux d'occupation.</dd>

                    <dt><strong>Courant</strong></dt>
                    <dd>Description textuelle du mouvement de trafic associé au groupe de feux (ex : « Entrée Nord », « Tourne-à-gauche Est »).</dd>

                    <dt><strong>Cycle</strong></dt>
                    <dd>Durée totale (en secondes) d'une séquence complète des phases du carrefour. Paramètre principal du diagramme.</dd>

                    <dt><strong>DA (Délai d'Approche)</strong></dt>
                    <dd>Temps de parcours entre un point d'appel (détecteur ou position géographique) et la ligne d'effet. Utilisé notamment pour la priorité bus et les flèches d'anticipation.</dd>

                    <dt><strong>Diagramme de feux</strong></dt>
                    <dd>Représentation temporelle d'un cycle de feux, où chaque groupe dispose d'une ligne et chaque phase (vert, orange, rouge) est visualisée par une barre colorée.</dd>

                    <dt><strong>Escamotage de phase</strong></dt>
                    <dd>Action de micro-régulation qui supprime (contracte) une tranche temporelle du cycle sur tous les groupes, raccourcissant temporairement le cycle global.</dd>

                    <dt><strong>Fermeture anticipée</strong></dt>
                    <dd>Action qui raccourcit la durée de vert d'un groupe de feux en anticipant sa fin. Représentée par une accolade sur la fin du vert. Lorsqu'elle est associée à une action sur un autre groupe de feu (champ <em>Action GF</em>), on parle également de <em>glissement</em>.</dd>

                    <dt><strong>Flèche d'anticipation</strong></dt>
                    <dd>Indication visuelle matérialisée par une barre intermittente jaune, représentant un dispositif visuel pour le conducteur (signal d'approche) en amont du groupe de feux.</dd>

                    <dt><strong>Gestion par groupe de feu</strong></dt>
                    <dd>Mode de régulation où chaque groupe de feux (GF) est piloté indépendamment, avec ses propres durées et conditions de vert. Offre une granularité fine mais demande une coordination rigoureuse.</dd>

                    <dt><strong>Gestion par phase</strong></dt>
                    <dd>Mode de régulation où les groupes compatibles sont regroupés en phases, pilotées de façon synchrone. Simplifie la configuration au prix d'une souplesse moindre qu'une gestion par groupe.</dd>

                    <dt><strong>Glissement</strong></dt>
                    <dd>Effet d'une fermeture anticipée associée à une action sur un autre groupe de feu (via le champ <em>Action GF</em>) : le début ou la fin du vert du groupe cible est décalé en cohérence avec le groupe source. Permet de propager une régulation entre groupes liés sans recopier la consigne.</dd>

                    <dt><strong>Groupe de feux (GF)</strong></dt>
                    <dd>Ensemble de feux tricolores d'un même mouvement, pilotés simultanément. Également appelé <em>ligne de feu</em> dans certains contextes métier. Chaque GF est caractérisé par un type (VL, TC, Piéton, Cycliste), un courant, une durée de vert minimal et des durées de phase.</dd>

                    <dt><strong>HPM, HPS, HC, HN</strong></dt>
                    <dd>Périodes types utilisées pour la caractérisation du trafic :
                        <ul style={{ marginTop: '4px' }}>
                            <li><strong>HPM</strong> — Heure de Pointe du Matin</li>
                            <li><strong>HPS</strong> — Heure de Pointe du Soir</li>
                            <li><strong>HC</strong> — Heure Creuse (ou Heure moyenne)</li>
                            <li><strong>HN</strong> — Heure de Nuit</li>
                        </ul>
                    </dd>

                    <dt><strong>Instant CO</strong></dt>
                    <dd>Action de micro-régulation qui repère un instant précis du cycle (« Cycle Outil » / moment de coordination). Matérialisé dans le diagramme par des flèches verticales orange.</dd>

                    <dt><strong>Intervert (temps d')</strong></dt>
                    <dd>Temps de dégagement minimal (en secondes) à respecter entre la fin du vert d'un groupe et le début du vert d'un groupe antagoniste. Stocké dans la matrice des interverts.</dd>

                    <dt><strong>Matrice des interverts</strong></dt>
                    <dd>Tableau NxN (N = nombre de groupes) indiquant les temps de dégagement nécessaires entre chaque paire de groupes conflictuels. Permet la détection automatique des conflits dans le diagramme.</dd>

                    <dt><strong>Micro-régulation</strong></dt>
                    <dd>Ensemble des mécanismes (adaptatif, escamotage, fermeture/ouverture anticipée, priorité…) permettant d'ajuster le cycle en fonction de la demande réelle (détections, bus, piétons).</dd>

                    <dt><strong>Onde verte</strong></dt>
                    <dd>Coordination temporelle de plusieurs carrefours successifs sur un même axe, de façon à ce qu'un véhicule qui roule à la vitesse prévue rencontre des feux verts de manière continue.</dd>

                    <dt><strong>Ouverture anticipée</strong></dt>
                    <dd>Action symétrique à la fermeture anticipée : elle avance le début du vert d'un groupe de feux par rapport à sa durée nominale.</dd>

                    <dt><strong>Phase</strong></dt>
                    <dd>Sous-période du cycle pendant laquelle un ensemble de groupes compatibles est simultanément au vert.</dd>

                    <dt><strong>Phasage bulle</strong></dt>
                    <dd>Représentation graphique synthétique des phases d'un cycle sous forme de bulles colorées, utilisée comme vue d'ensemble du plan de feu.</dd>

                    <dt><strong>Plan de feux (PF)</strong></dt>
                    <dd>Configuration temporelle complète d'un cycle de feux (durées, offsets, actions). Une application peut contenir plusieurs plans de feux (PF1, PF2, ...) permettant de comparer des scénarios ou de gérer différentes périodes horaires.</dd>

                    <dt><strong>Point de repos</strong></dt>
                    <dd>Action de micro-régulation qui définit un point du cycle où le contrôleur « attend » (feu maintenu dans un état) jusqu'à ce qu'une condition de micro-régulation déclenche la suite. Représenté dans le diagramme par des flèches verticales rouges.</dd>

                    <dt><strong>Priorité bus</strong></dt>
                    <dd>Ensemble de mécanismes (allongement de vert, escamotage de phase, point de repos, etc.) permettant d'accorder un avantage temporel aux transports en commun détectés à l'approche du carrefour.</dd>

                    <dt><strong>Priorité piétons</strong></dt>
                    <dd>Action de micro-régulation qui réduit le temps d'attente d'un piéton en avançant le vert piéton dès qu'une détection piétonne le justifie.</dd>

                    <dt><strong>Seconde lucarne</strong></dt>
                    <dd>Second feu complémentaire pour un groupe, permettant un second vert dans le cycle — utilisé pour certains mouvements nécessitant deux créneaux (piéton bidirectionnel, par exemple).</dd>

                    <dt><strong>Synchro BTS</strong></dt>
                    <dd>Action de synchronisation de type « Base de Temps Système » — permet d'aligner le cycle local sur un signal de synchronisation externe (ex : coordination de carrefours en cascade). Représentée dans le diagramme par des flèches verticales bleues.</dd>

                    <dt><strong>TMAB (Temps Moyen d'Attente Bus)</strong></dt>
                    <dd>Indicateur de performance mesurant le temps moyen d'attente des bus à un carrefour. Utilisé pour évaluer l'efficacité de la priorité bus.</dd>

                    <dt><strong>TPPh (Temps Passé dans la Phase)</strong></dt>
                    <dd>Variable de micro-régulation indiquant le temps écoulé depuis le début de la phase en cours. Utilisée dans les conditions conditionnelles (ex : allonger le vert tant que TPPh {'<'} X).</dd>

                    <dt><strong>Vert minimum (Vm)</strong></dt>
                    <dd>Durée minimale obligatoire du vert d'un groupe, pour garantir la sécurité et le confort des usagers (traversée piétonne complète, dégagement véhicule, etc.). Seuil en dessous duquel une alerte se déclenche.</dd>
                </dl>
            </section>
            {/* Bouton flottant "retour au sommaire" */}
            <button
                className="help-back-to-top"
                onClick={() => document.getElementById('help-sommaire')?.scrollIntoView({ behavior: 'auto', block: 'start' })}
                title="Retour au sommaire"
                aria-label="Retour au sommaire de l'aide"
            >
                ↑
            </button>
        </div>
    );
};

export default HelpContent;
