import { useEffect, useRef } from "react";
import { driver, type DriveStep, type Driver } from "driver.js";
import "driver.js/dist/driver.css";
import { profilesRepo } from "@/db";
import { useSessionStore, useUiStore } from "@/stores";

const TOUR_STEPS: DriveStep[] = [
  {
    element: '[data-tour="bottom-dock"]',
    popover: {
      title: "Bem-vindo ao BysMoney",
      description:
        "Dock flutuante: busca e configurações nas pontas, hubs no centro. Passe o mouse em Finanças, Planos ou Relatórios para ver as abas.",
      side: "top",
      align: "center",
    },
  },
  {
    element: '[data-tour="search-chip"]',
    popover: {
      title: "Busca rápida",
      description:
        "Encontre páginas, ações e dados em segundos. Atalho: Ctrl+K.",
      side: "top",
      align: "center",
    },
  },
  {
    element: '[data-tour="nav-dashboard"]',
    popover: {
      title: "Dashboard",
      description: "Visão geral das suas finanças e indicadores principais.",
      side: "top",
      align: "center",
    },
  },
  {
    element: '[data-tour="nav-finances"]',
    popover: {
      title: "Finanças",
      description:
        "Clique para abrir. Passe o mouse para saltar direto a lançamentos, contas, categorias ou futuros.",
      side: "top",
      align: "center",
    },
  },
  {
    element: '[data-tour="nav-planning"]',
    popover: {
      title: "Planejamento",
      description:
        "Orçamentos, metas e recorrências. Hover revela o atalho para cada aba.",
      side: "top",
      align: "center",
    },
  },
  {
    element: '[data-tour="nav-reports"]',
    popover: {
      title: "Relatórios",
      description: "Análises por categoria, tendências, contas e orçamentos.",
      side: "top",
      align: "center",
    },
  },
  {
    element: '[data-tour="new-transaction"]',
    popover: {
      title: "Novo lançamento",
      description:
        "Botão flutuante para registrar receitas e despesas. Atalho: n.",
      side: "left",
      align: "center",
    },
  },
  {
    element: '[data-tour="hide-balances"]',
    popover: {
      title: "Privacidade",
      description:
        "Oculte ou mostre saldos quando precisar de mais discrição.",
      side: "bottom",
      align: "end",
    },
  },
  {
    element: '[data-tour="nav-settings"]',
    popover: {
      title: "Configurações",
      description: "Preferências, tema, notificações e dados da conta.",
      side: "top",
      align: "center",
    },
  },
];

async function markTourCompleted() {
  const { profile, preferences, updatePreferences } = useSessionStore.getState();
  if (!profile || preferences.productTourCompleted) return;

  const nextPreferences = { ...preferences, productTourCompleted: true };
  updatePreferences({ productTourCompleted: true });
  await profilesRepo.updatePreferences(profile.id, nextPreferences);
}

export function startProductTour() {
  const driverObj = driver({
    showProgress: true,
    progressText: "{{current}} de {{total}}",
    nextBtnText: "Próximo",
    prevBtnText: "Anterior",
    doneBtnText: "Concluir",
    steps: TOUR_STEPS,
    onDestroyed: () => {
      void markTourCompleted();
      useUiStore.getState().setTourOpen(false);
    },
  });

  driverObj.drive();
  return driverObj;
}

export function ProductTourHost() {
  const tourOpen = useUiStore((s) => s.tourOpen);
  const driverRef = useRef<Driver | null>(null);

  useEffect(() => {
    if (!tourOpen) {
      return;
    }

    const timer = window.setTimeout(() => {
      driverRef.current = startProductTour();
    }, 350);

    return () => {
      window.clearTimeout(timer);
    };
  }, [tourOpen]);

  return null;
}
