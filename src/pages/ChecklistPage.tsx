import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuthStore } from "../store/authStore";
import { Button } from "../components/ui/Button";

export default function ChecklistPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { profile } = useAuthStore();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [alreadySentToday, setAlreadySentToday] = useState(false);
    const [checklist, setChecklist] = useState({
        limpeza_realizada: false,
        materiais_guardados: false,
        equipamentos_desligados: false,
        ferramentas_conferidas: false,
        epi_guardado: false,
        observacoes: "",
    });

    // 🔥 Verificar se já existe checklist hoje
    useEffect(() => {
        if (!id || !profile?.id) return;
        checkIfChecklistExists();
    }, [id, profile?.id]);

    const checkIfChecklistExists = async () => {
        const today = new Date().toISOString().split("T")[0];

        const { data } = await supabase
            .from("checklist_diario")
            .select("*")
            .eq("project_id", id)
            .eq("user_id", profile?.id)
            .eq("date", today)
            .maybeSingle();

        if (data) setAlreadySentToday(true);
        setLoading(false);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!profile?.id) return;

        setSaving(true);

        const today = new Date().toISOString().split("T")[0];

        const { error } = await supabase.from("checklist_diario").insert({
            project_id: id,
            user_id: profile.id,
            date: today,
            ...checklist,
        });

        setSaving(false);

        if (error) {
            alert("Erro ao salvar checklist.");
            return;
        }

        alert("Checklist enviado com sucesso!");
        navigate(`/projects/${id}`);
    };

    if (loading) {
        return (
            <div className="flex justify-center py-10 text-gray-400">
                Carregando...
            </div>
        );
    }

    if (alreadySentToday) {
        return (
            <div className="p-6 bg-marvil-card border border-marvil-border rounded-lg text-center">
                <h2 className="text-xl font-bold text-white mb-4">
                    Checklist já enviado hoje
                </h2>
                <p className="text-gray-400 mb-6">
                    Você já preencheu o checklist diário desta obra.
                </p>
                <Button onClick={() => navigate(`/projects/${id}`)}>
                    Voltar para Obra
                </Button>
            </div>
        );
    }

    return (
        <div className="max-w-2xl mx-auto bg-marvil-card border border-marvil-border p-6 rounded-lg text-white">
            <h1 className="text-2xl font-bold mb-6">Checklist Diário</h1>

            <form onSubmit={handleSubmit} className="space-y-6">

                {[
                    { key: "limpeza_realizada", label: "Limpeza final realizada" },
                    { key: "materiais_guardados", label: "Materiais guardados" },
                    { key: "equipamentos_desligados", label: "Equipamentos desligados" },
                    { key: "ferramentas_conferidas", label: "Ferramentas conferidas" },
                    { key: "epi_guardado", label: "EPIs guardados" },
                ].map((item) => (
                    <label
                        key={item.key}
                        className="flex items-center gap-3 bg-marvil-dark p-3 rounded border border-marvil-border cursor-pointer"
                    >
                        <input
                            type="checkbox"
                            className="w-5 h-5 accent-marvil-orange"
                            checked={(checklist as any)[item.key]}
                            onChange={(e) =>
                                setChecklist((prev) => ({
                                    ...prev,
                                    [item.key]: e.target.checked,
                                }))
                            }
                        />
                        <span>{item.label}</span>
                    </label>
                ))}

                <div>
                    <label className="block mb-1 text-gray-400">Observações</label>
                    <textarea
                        className="w-full bg-marvil-dark border border-marvil-border rounded p-3 text-white"
                        rows={4}
                        value={checklist.observacoes}
                        onChange={(e) =>
                            setChecklist((prev) => ({ ...prev, observacoes: e.target.value }))
                        }
                    />
                </div>

                <Button type="submit" isLoading={saving} className="w-full">
                    Enviar Checklist
                </Button>
            </form>
        </div>
    );
}
