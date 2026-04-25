// ====================================================================
// PIEUVRE AUTO - Formulaire Principal AutoCAD
// Interface WinForms pour saisie des circuits et calcul du bon de coupe
// ====================================================================

using System;
using System.Collections.Generic;
using System.Drawing;
using System.Linq;
using System.Threading.Tasks;
using System.Windows.Forms;
using PieuvreAutoCAD.Models;

namespace PieuvreAutoCAD.UI
{
    public class MainForm : Form
    {
        // ================================================================
        // TYPES DE CIRCUITS DISPONIBLES
        // ================================================================

        private static readonly string[] TYPES_LABELS = new[]
        {
            "Prise (P)",
            "Lumière (L)",
            "Va-et-vient (VD)",
            "Double allumage (DA)",
            "Télérupteur (TEL)",
            "Bloc secours (BS)",
            "VMC",
            "Volet roulant (VR)",
            "Cuisinière (CUIS)",
            "Lave-linge (LL)",
            "Lave-vaisselle (LV)",
            "Prise extérieur (PG)"
        };

        private static readonly Dictionary<string, string> TYPE_CODES = new Dictionary<string, string>
        {
            { "Prise (P)",            "prise"           },
            { "Lumière (L)",          "lumiere"         },
            { "Va-et-vient (VD)",     "va-et-vient"     },
            { "Double allumage (DA)", "double-allumage"  },
            { "Télérupteur (TEL)",    "telerupteur"     },
            { "Bloc secours (BS)",    "bs"              },
            { "VMC",                  "vmc"             },
            { "Volet roulant (VR)",   "volet"           },
            { "Cuisinière (CUIS)",    "cuisiniere"      },
            { "Lave-linge (LL)",      "ll"              },
            { "Lave-vaisselle (LV)", "lv"              },
            { "Prise extérieur (PG)","prise"           }
        };

        // ================================================================
        // CONTRÔLES UI
        // ================================================================

        private TabControl tabControl;
        private TabPage tabProjet, tabCircuits, tabResultats;

        // Tab Projet
        private ComboBox cboClients;
        private ComboBox cboChantiers;
        private Label lblSectionsInfo;
        private Label lblCouleursInfo;
        private Label lblStatusProjet;

        // Tab Circuits
        private DataGridView dgvCircuits;
        private DataGridViewTextBoxColumn colNumero;
        private DataGridViewComboBoxColumn colType;
        private DataGridViewTextBoxColumn colLongueur;
        private DataGridViewTextBoxColumn colDescription;
        private Button btnAjouter;
        private Button btnSupprimer;

        // Tab Résultats
        private DataGridView dgvFils;
        private DataGridView dgvGaines;
        private RichTextBox rtbAlertes;
        private Label lblStats;

        // Boutons bas de page
        private Button btnCalculer;
        private Button btnSauvegarder;
        private Button btnFermer;
        private Label lblStatus;

        // ================================================================
        // DONNÉES
        // ================================================================

        private List<Client> _clients = new List<Client>();
        private List<Chantier> _chantiers = new List<Chantier>();
        private BonDeCoupe _bonDeCoupe;

        // ================================================================
        // CONSTRUCTEUR
        // ================================================================

        public MainForm()
        {
            InitializeComponent();
            _ = LoadClientsAsync();
        }

        // ================================================================
        // CONSTRUCTION DE L'INTERFACE
        // ================================================================

        private void InitializeComponent()
        {
            this.Text = "Pieuvre Auto";
            this.Size = new Size(700, 560);
            this.MinimumSize = new Size(600, 480);
            this.StartPosition = FormStartPosition.CenterScreen;
            this.FormBorderStyle = FormBorderStyle.Sizable;
            this.Font = new Font("Segoe UI", 9f);
            this.BackColor = Color.FromArgb(245, 245, 250);

            BuildTabs();
            BuildButtons();
        }

        private void BuildTabs()
        {
            tabControl = new TabControl
            {
                Dock = DockStyle.None,
                Location = new Point(10, 10),
                Anchor = AnchorStyles.Top | AnchorStyles.Left | AnchorStyles.Right | AnchorStyles.Bottom
            };

            tabProjet = new TabPage("1 - Projet");
            tabCircuits = new TabPage("2 - Circuits");
            tabResultats = new TabPage("3 - Résultats");

            BuildTabProjet();
            BuildTabCircuits();
            BuildTabResultats();

            tabControl.TabPages.AddRange(new[] { tabProjet, tabCircuits, tabResultats });
            this.Controls.Add(tabControl);

            ResizeTabControl();
            this.Resize += (s, e) => ResizeTabControl();
        }

        private void ResizeTabControl()
        {
            tabControl.Size = new Size(
                this.ClientSize.Width - 20,
                this.ClientSize.Height - 80
            );
        }

        private void BuildTabProjet()
        {
            var panel = new TableLayoutPanel
            {
                Dock = DockStyle.Fill,
                ColumnCount = 2,
                RowCount = 6,
                Padding = new Padding(12),
                AutoSize = false
            };
            panel.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 120));
            panel.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100));

            // Client
            panel.Controls.Add(new Label { Text = "Client :", TextAlign = ContentAlignment.MiddleLeft, Dock = DockStyle.Fill }, 0, 0);
            cboClients = new ComboBox { DropDownStyle = ComboBoxStyle.DropDownList, Dock = DockStyle.Fill };
            cboClients.SelectedIndexChanged += CboClients_SelectedIndexChanged;
            panel.Controls.Add(cboClients, 1, 0);

            // Chantier
            panel.Controls.Add(new Label { Text = "Chantier :", TextAlign = ContentAlignment.MiddleLeft, Dock = DockStyle.Fill }, 0, 1);
            cboChantiers = new ComboBox { DropDownStyle = ComboBoxStyle.DropDownList, Dock = DockStyle.Fill };
            cboChantiers.SelectedIndexChanged += CboChantiers_SelectedIndexChanged;
            panel.Controls.Add(cboChantiers, 1, 1);

            // Séparateur
            panel.Controls.Add(new Label { Text = "", Dock = DockStyle.Fill }, 0, 2);
            panel.Controls.Add(new Label { Text = "", Dock = DockStyle.Fill }, 1, 2);

            // Sections
            panel.Controls.Add(new Label { Text = "Sections :", TextAlign = ContentAlignment.MiddleLeft, Dock = DockStyle.Fill }, 0, 3);
            lblSectionsInfo = new Label { Text = "—", TextAlign = ContentAlignment.MiddleLeft, Dock = DockStyle.Fill, ForeColor = Color.DarkBlue };
            panel.Controls.Add(lblSectionsInfo, 1, 3);

            // Couleurs
            panel.Controls.Add(new Label { Text = "Couleurs :", TextAlign = ContentAlignment.MiddleLeft, Dock = DockStyle.Fill }, 0, 4);
            lblCouleursInfo = new Label { Text = "—", TextAlign = ContentAlignment.MiddleLeft, Dock = DockStyle.Fill, ForeColor = Color.DarkGreen };
            panel.Controls.Add(lblCouleursInfo, 1, 4);

            // Status
            lblStatusProjet = new Label
            {
                Text = "Chargement des clients...",
                Dock = DockStyle.Fill,
                ForeColor = Color.Gray,
                TextAlign = ContentAlignment.MiddleLeft
            };
            panel.SetColumnSpan(lblStatusProjet, 2);
            panel.Controls.Add(lblStatusProjet, 0, 5);

            tabProjet.Controls.Add(panel);
        }

        private void BuildTabCircuits()
        {
            var panel = new Panel { Dock = DockStyle.Fill, Padding = new Padding(8) };

            // Barre d'outils circuits
            var toolbar = new Panel { Height = 36, Dock = DockStyle.Top };

            btnAjouter = new Button
            {
                Text = "+ Ajouter",
                Size = new Size(90, 28),
                Location = new Point(0, 4),
                BackColor = Color.FromArgb(70, 130, 180),
                ForeColor = Color.White,
                FlatStyle = FlatStyle.Flat
            };
            btnAjouter.FlatAppearance.BorderSize = 0;
            btnAjouter.Click += BtnAjouter_Click;

            btnSupprimer = new Button
            {
                Text = "- Supprimer",
                Size = new Size(90, 28),
                Location = new Point(96, 4),
                BackColor = Color.FromArgb(200, 80, 60),
                ForeColor = Color.White,
                FlatStyle = FlatStyle.Flat
            };
            btnSupprimer.FlatAppearance.BorderSize = 0;
            btnSupprimer.Click += BtnSupprimer_Click;

            toolbar.Controls.AddRange(new Control[] { btnAjouter, btnSupprimer });

            // Grille des circuits
            dgvCircuits = new DataGridView
            {
                Dock = DockStyle.Fill,
                AllowUserToAddRows = false,
                AllowUserToDeleteRows = false,
                RowHeadersVisible = false,
                SelectionMode = DataGridViewSelectionMode.FullRowSelect,
                AutoSizeColumnsMode = DataGridViewAutoSizeColumnsMode.Fill,
                BackgroundColor = Color.White,
                BorderStyle = BorderStyle.None,
                GridColor = Color.LightGray
            };

            colNumero = new DataGridViewTextBoxColumn
            {
                HeaderText = "Numéro",
                Name = "Numero",
                FillWeight = 15,
                DefaultCellStyle = new DataGridViewCellStyle { Alignment = DataGridViewContentAlignment.MiddleCenter }
            };

            colType = new DataGridViewComboBoxColumn
            {
                HeaderText = "Type de circuit",
                Name = "Type",
                FillWeight = 35,
                DataSource = TYPES_LABELS,
                DisplayStyle = DataGridViewComboBoxDisplayStyle.DropDownButton
            };

            colLongueur = new DataGridViewTextBoxColumn
            {
                HeaderText = "Longueur (m)",
                Name = "Longueur",
                FillWeight = 20,
                DefaultCellStyle = new DataGridViewCellStyle { Alignment = DataGridViewContentAlignment.MiddleRight }
            };

            colDescription = new DataGridViewTextBoxColumn
            {
                HeaderText = "Notes",
                Name = "Description",
                FillWeight = 30
            };

            dgvCircuits.Columns.AddRange(new DataGridViewColumn[] { colNumero, colType, colLongueur, colDescription });

            panel.Controls.Add(dgvCircuits);
            panel.Controls.Add(toolbar);

            tabCircuits.Controls.Add(panel);
        }

        private void BuildTabResultats()
        {
            var splitMain = new SplitContainer
            {
                Dock = DockStyle.Fill,
                Orientation = Orientation.Horizontal,
                SplitterDistance = 220,
                Panel1MinSize = 120,
                Panel2MinSize = 80
            };

            // Panel haut : fils + gaines côte à côte
            var splitHaut = new SplitContainer
            {
                Dock = DockStyle.Fill,
                Orientation = Orientation.Vertical,
                SplitterDistance = 300
            };

            // Fils
            var panelFils = new Panel { Dock = DockStyle.Fill };
            panelFils.Controls.Add(new Label { Text = "FILS À COUPER", Dock = DockStyle.Top, Height = 22, Font = new Font("Segoe UI", 9f, FontStyle.Bold), ForeColor = Color.DarkBlue });
            dgvFils = BuildResultGrid();
            dgvFils.Columns.Add(new DataGridViewTextBoxColumn { HeaderText = "Couleur", Name = "Couleur", FillWeight = 35 });
            dgvFils.Columns.Add(new DataGridViewTextBoxColumn { HeaderText = "Section", Name = "Section", FillWeight = 25 });
            dgvFils.Columns.Add(new DataGridViewTextBoxColumn { HeaderText = "Longueur", Name = "Longueur", FillWeight = 25 });
            dgvFils.Columns.Add(new DataGridViewTextBoxColumn { HeaderText = "Note", Name = "Note", FillWeight = 15 });
            panelFils.Controls.Add(dgvFils);

            // Gaines
            var panelGaines = new Panel { Dock = DockStyle.Fill };
            panelGaines.Controls.Add(new Label { Text = "GAINES", Dock = DockStyle.Top, Height = 22, Font = new Font("Segoe UI", 9f, FontStyle.Bold), ForeColor = Color.DarkBlue });
            dgvGaines = BuildResultGrid();
            dgvGaines.Columns.Add(new DataGridViewTextBoxColumn { HeaderText = "Diamètre", Name = "Diametre", FillWeight = 40 });
            dgvGaines.Columns.Add(new DataGridViewTextBoxColumn { HeaderText = "Longueur", Name = "Longueur", FillWeight = 60 });
            panelGaines.Controls.Add(dgvGaines);

            splitHaut.Panel1.Controls.Add(panelFils);
            splitHaut.Panel2.Controls.Add(panelGaines);

            // Panel bas : alertes + stats
            var panelBas = new Panel { Dock = DockStyle.Fill, Padding = new Padding(0, 4, 0, 0) };
            panelBas.Controls.Add(new Label { Text = "ALERTES", Dock = DockStyle.Top, Height = 20, Font = new Font("Segoe UI", 9f, FontStyle.Bold), ForeColor = Color.DarkRed });
            rtbAlertes = new RichTextBox { Dock = DockStyle.Fill, ReadOnly = true, BorderStyle = BorderStyle.None, BackColor = Color.FromArgb(255, 250, 245), Font = new Font("Consolas", 8.5f) };
            lblStats = new Label { Dock = DockStyle.Bottom, Height = 22, ForeColor = Color.DimGray, Font = new Font("Segoe UI", 8.5f) };
            panelBas.Controls.AddRange(new Control[] { rtbAlertes, lblStats });

            splitMain.Panel1.Controls.Add(splitHaut);
            splitMain.Panel2.Controls.Add(panelBas);

            tabResultats.Controls.Add(splitMain);
        }

        private DataGridView BuildResultGrid()
        {
            return new DataGridView
            {
                Dock = DockStyle.Fill,
                ReadOnly = true,
                AllowUserToAddRows = false,
                RowHeadersVisible = false,
                SelectionMode = DataGridViewSelectionMode.FullRowSelect,
                AutoSizeColumnsMode = DataGridViewAutoSizeColumnsMode.Fill,
                BackgroundColor = Color.White,
                BorderStyle = BorderStyle.None,
                GridColor = Color.LightGray
            };
        }

        private void BuildButtons()
        {
            var panelBas = new Panel
            {
                Height = 44,
                Dock = DockStyle.Bottom,
                Padding = new Padding(8, 6, 8, 6),
                BackColor = Color.FromArgb(230, 230, 240)
            };

            lblStatus = new Label
            {
                Dock = DockStyle.Left,
                Width = 280,
                TextAlign = ContentAlignment.MiddleLeft,
                ForeColor = Color.DimGray,
                Font = new Font("Segoe UI", 8.5f)
            };

            btnFermer = new Button
            {
                Text = "Fermer",
                Size = new Size(80, 28),
                Dock = DockStyle.Right,
                BackColor = Color.FromArgb(220, 220, 220),
                FlatStyle = FlatStyle.Flat
            };
            btnFermer.FlatAppearance.BorderSize = 0;
            btnFermer.Click += (s, e) => this.Close();

            btnSauvegarder = new Button
            {
                Text = "Sauvegarder",
                Size = new Size(100, 28),
                Dock = DockStyle.Right,
                BackColor = Color.FromArgb(60, 160, 100),
                ForeColor = Color.White,
                FlatStyle = FlatStyle.Flat,
                Enabled = false
            };
            btnSauvegarder.FlatAppearance.BorderSize = 0;
            btnSauvegarder.Click += BtnSauvegarder_Click;

            btnCalculer = new Button
            {
                Text = "Calculer",
                Size = new Size(90, 28),
                Dock = DockStyle.Right,
                BackColor = Color.FromArgb(70, 130, 180),
                ForeColor = Color.White,
                FlatStyle = FlatStyle.Flat
            };
            btnCalculer.FlatAppearance.BorderSize = 0;
            btnCalculer.Click += BtnCalculer_Click;

            panelBas.Controls.AddRange(new Control[] { lblStatus, btnFermer, btnSauvegarder, btnCalculer });
            this.Controls.Add(panelBas);
        }

        // ================================================================
        // CHARGEMENT DES DONNÉES
        // ================================================================

        private async Task LoadClientsAsync()
        {
            SetStatus("Chargement des clients...");
            try
            {
                var response = await Task.Run(() => Core.ApiClient.GetClients());

                if (response?.Data == null)
                {
                    SetStatus("Impossible de charger les clients. Vérifiez la connexion API.");
                    lblStatusProjet.Text = "Connexion API impossible — vérifiez que le serveur est démarré.";
                    return;
                }

                _clients = response.Data;

                this.Invoke((Action)(() =>
                {
                    cboClients.Items.Clear();
                    cboClients.Items.Add("— Sélectionnez un client —");
                    foreach (var client in _clients)
                        cboClients.Items.Add(client);
                    cboClients.SelectedIndex = 0;
                    lblStatusProjet.Text = $"{_clients.Count} client(s) chargé(s).";
                }));

                SetStatus("Prêt.");
            }
            catch (Exception ex)
            {
                SetStatus($"Erreur: {ex.Message}");
            }
        }

        private async Task LoadChantiersAsync(int clientId)
        {
            SetStatus("Chargement des chantiers...");
            try
            {
                var response = await Task.Run(() => Core.ApiClient.GetChantiers(clientId));

                if (response?.Data == null)
                {
                    SetStatus("Impossible de charger les chantiers.");
                    return;
                }

                _chantiers = response.Data;

                this.Invoke((Action)(() =>
                {
                    cboChantiers.Items.Clear();
                    cboChantiers.Items.Add("— Sélectionnez un chantier —");
                    foreach (var chantier in _chantiers)
                        cboChantiers.Items.Add(chantier);
                    cboChantiers.SelectedIndex = 0;
                }));

                SetStatus("Prêt.");
            }
            catch (Exception ex)
            {
                SetStatus($"Erreur: {ex.Message}");
            }
        }

        // ================================================================
        // ÉVÉNEMENTS
        // ================================================================

        private void CboClients_SelectedIndexChanged(object sender, EventArgs e)
        {
            if (cboClients.SelectedItem is Client client)
            {
                lblSectionsInfo.Text = $"Prises: {client.PrisesSection}mm²  |  Éclairage: {client.EclairageSection}mm²  |  Cuisson: {client.CuissonSection}mm²";
                lblCouleursInfo.Text = client.CouleursPreferees != null
                    ? string.Join(", ", client.CouleursPreferees)
                    : "Standard";

                cboChantiers.Items.Clear();
                _ = LoadChantiersAsync(client.Id);
            }
            else
            {
                lblSectionsInfo.Text = "—";
                lblCouleursInfo.Text = "—";
                cboChantiers.Items.Clear();
            }
        }

        private void CboChantiers_SelectedIndexChanged(object sender, EventArgs e)
        {
            if (cboChantiers.SelectedItem is Chantier chantier)
            {
                // Sauvegarder le profil pour la prochaine utilisation
                var profil = new ProfilUtilise
                {
                    ClientId = chantier.IdClient,
                    ClientNom = chantier.ClientNom,
                    ChantierId = chantier.Id,
                    ChantierNom = chantier.Nom,
                    DerniereUtilisation = DateTime.Now
                };
                Core.Configuration.SaveLastUsedProfile(profil);
                SetStatus($"Chantier sélectionné : {chantier.ClientNom} — {chantier.Nom}");
            }
        }

        private void BtnAjouter_Click(object sender, EventArgs e)
        {
            int rowIndex = dgvCircuits.Rows.Add();
            var row = dgvCircuits.Rows[rowIndex];

            // Numéro automatique
            int nb = dgvCircuits.Rows.Count;
            row.Cells["Numero"].Value = $"C{nb}";
            row.Cells["Type"].Value = TYPES_LABELS[0];
            row.Cells["Longueur"].Value = "1.0";
            row.Cells["Description"].Value = "";

            dgvCircuits.ClearSelection();
            dgvCircuits.CurrentCell = dgvCircuits.Rows[rowIndex].Cells["Numero"];
            dgvCircuits.BeginEdit(true);
        }

        private void BtnSupprimer_Click(object sender, EventArgs e)
        {
            if (dgvCircuits.SelectedRows.Count == 0) return;
            foreach (DataGridViewRow row in dgvCircuits.SelectedRows)
            {
                if (!row.IsNewRow)
                    dgvCircuits.Rows.Remove(row);
            }
        }

        private async void BtnCalculer_Click(object sender, EventArgs e)
        {
            if (!(cboChantiers.SelectedItem is Chantier chantier))
            {
                MessageBox.Show("Sélectionnez d'abord un chantier.", "Pieuvre Auto", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                tabControl.SelectedTab = tabProjet;
                return;
            }

            if (dgvCircuits.Rows.Count == 0)
            {
                MessageBox.Show("Ajoutez au moins un circuit.", "Pieuvre Auto", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                tabControl.SelectedTab = tabCircuits;
                return;
            }

            // Lire les circuits depuis la grille
            var circuits = new List<CircuitInput>();
            foreach (DataGridViewRow row in dgvCircuits.Rows)
            {
                var numero = row.Cells["Numero"].Value?.ToString()?.Trim();
                var typeLabel = row.Cells["Type"].Value?.ToString();
                var longueurStr = row.Cells["Longueur"].Value?.ToString()?.Replace(",", ".");
                var description = row.Cells["Description"].Value?.ToString() ?? "";

                if (string.IsNullOrEmpty(numero) || string.IsNullOrEmpty(typeLabel)) continue;
                if (!decimal.TryParse(longueurStr, System.Globalization.NumberStyles.Any,
                    System.Globalization.CultureInfo.InvariantCulture, out decimal longueur) || longueur <= 0)
                {
                    MessageBox.Show($"Longueur invalide pour le circuit '{numero}'.", "Pieuvre Auto", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                    return;
                }

                string typeCode = TYPE_CODES.TryGetValue(typeLabel, out string code) ? code : "prise";

                circuits.Add(new CircuitInput
                {
                    Id = numero,
                    Type = typeCode,
                    Longueur = longueur,
                    Description = description
                });
            }

            SetStatus("Calcul en cours...");
            btnCalculer.Enabled = false;
            btnSauvegarder.Enabled = false;

            try
            {
                var bonDeCoupe = await Task.Run(() => Core.ApiClient.ComputeBonDeCoupe(chantier.Id, circuits));

                if (bonDeCoupe == null)
                {
                    SetStatus("Erreur lors du calcul.");
                    MessageBox.Show("Calcul impossible. Vérifiez la connexion API.", "Pieuvre Auto", MessageBoxButtons.OK, MessageBoxIcon.Error);
                    return;
                }

                _bonDeCoupe = bonDeCoupe;
                this.Invoke((Action)(() => DisplayResultats(bonDeCoupe)));
                tabControl.SelectedTab = tabResultats;
                btnSauvegarder.Enabled = true;
                SetStatus($"Calcul terminé — {bonDeCoupe.Fils?.Count ?? 0} fil(s), {bonDeCoupe.Gaines?.Count ?? 0} gaine(s).");
            }
            catch (Exception ex)
            {
                SetStatus($"Erreur: {ex.Message}");
                MessageBox.Show($"Erreur lors du calcul:\n{ex.Message}", "Pieuvre Auto", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
            finally
            {
                btnCalculer.Enabled = true;
            }
        }

        private async void BtnSauvegarder_Click(object sender, EventArgs e)
        {
            if (_bonDeCoupe == null || !(cboChantiers.SelectedItem is Chantier chantier))
                return;

            btnSauvegarder.Enabled = false;
            SetStatus("Sauvegarde en cours...");

            try
            {
                var calcul = new CalculCreate
                {
                    IdChantier = chantier.Id,
                    Utilisateur = Core.Configuration.DefaultUser,
                    BonDeCoupe = _bonDeCoupe,
                    Commentaire = $"Calcul depuis AutoCAD — {DateTime.Now:dd/MM/yyyy HH:mm}"
                };

                var result = await Task.Run(() => Core.ApiClient.SaveCalcul(calcul));

                if (result != null)
                {
                    SetStatus($"Sauvegardé avec succès (ID: {result.Id}).");
                    MessageBox.Show($"Calcul enregistré avec succès !\nID: {result.Id}", "Pieuvre Auto", MessageBoxButtons.OK, MessageBoxIcon.Information);
                }
                else
                {
                    SetStatus("Erreur lors de la sauvegarde.");
                    MessageBox.Show("Impossible de sauvegarder le calcul.", "Pieuvre Auto", MessageBoxButtons.OK, MessageBoxIcon.Error);
                    btnSauvegarder.Enabled = true;
                }
            }
            catch (Exception ex)
            {
                SetStatus($"Erreur: {ex.Message}");
                MessageBox.Show($"Erreur lors de la sauvegarde:\n{ex.Message}", "Pieuvre Auto", MessageBoxButtons.OK, MessageBoxIcon.Error);
                btnSauvegarder.Enabled = true;
            }
        }

        // ================================================================
        // AFFICHAGE DES RÉSULTATS
        // ================================================================

        private void DisplayResultats(BonDeCoupe bdc)
        {
            // Fils
            dgvFils.Rows.Clear();
            if (bdc.Fils != null)
            {
                foreach (var fil in bdc.Fils.OrderBy(f => f.Section).ThenBy(f => f.Couleur))
                {
                    string note = fil.Substituee == true ? $"↳ remplace {fil.CouleurOriginale}" : "";
                    int rowIdx = dgvFils.Rows.Add(
                        fil.Couleur,
                        $"{fil.Section} mm²",
                        $"{fil.Longueur:F1} m",
                        note
                    );

                    // Mise en couleur si substitution
                    if (fil.Substituee == true)
                        dgvFils.Rows[rowIdx].DefaultCellStyle.BackColor = Color.FromArgb(255, 245, 200);
                }
            }

            // Gaines
            dgvGaines.Rows.Clear();
            if (bdc.Gaines != null)
            {
                foreach (var gaine in bdc.Gaines.OrderBy(g => g.Diametre))
                {
                    dgvGaines.Rows.Add($"Ø {gaine.Diametre} mm", $"{gaine.Longueur:F1} m");
                }
            }

            // Alertes
            rtbAlertes.Clear();
            if (bdc.Alertes != null && bdc.Alertes.Count > 0)
            {
                foreach (var alerte in bdc.Alertes)
                {
                    string prefix = alerte.Severite == "error" ? "❌ " :
                                    alerte.Severite == "warning" ? "⚠  " : "ℹ  ";
                    Color couleur = alerte.Severite == "error" ? Color.DarkRed :
                                    alerte.Severite == "warning" ? Color.DarkOrange : Color.DimGray;

                    rtbAlertes.SelectionColor = couleur;
                    rtbAlertes.AppendText($"{prefix}{alerte.Message}\n");
                }
            }
            else
            {
                rtbAlertes.ForeColor = Color.DarkGreen;
                rtbAlertes.Text = "✓  Aucune alerte — stock suffisant pour tous les circuits.";
            }

            // Stats
            if (bdc.Stats != null)
            {
                lblStats.Text = $"Total fils : {bdc.Stats.LongueurTotaleFils:F1} m  |  " +
                               $"Total gaines : {bdc.Stats.LongueurTotaleGaines:F1} m  |  " +
                               $"Substitutions : {bdc.Stats.NbSubstitutions}";
            }
        }

        // ================================================================
        // UTILITAIRES
        // ================================================================

        private void SetStatus(string message)
        {
            if (lblStatus.InvokeRequired)
                lblStatus.Invoke((Action)(() => lblStatus.Text = message));
            else
                lblStatus.Text = message;
        }
    }
}
